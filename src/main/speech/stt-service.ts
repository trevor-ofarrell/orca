/* eslint-disable max-lines -- Why: speech worker ownership, warm reuse, and
timeout teardown must stay co-located so dictation lifecycle state cannot drift. */
import { fork, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getCatalogModel } from './model-catalog'
import type { ModelManager } from './model-manager'
import { OpenAiTranscriptionSession } from './openai-transcription-client'
import { readOpenAiSpeechApiKey } from './openai-api-key-store'

export const START_DICTATION_TIMEOUT_MS = 60_000
const STOP_DICTATION_TIMEOUT_MS = 60_000
export const IDLE_WORKER_TEARDOWN_MS = 60 * 60 * 1000

export type SttEvent =
  | { type: 'ready' }
  | { type: 'partial'; text?: string }
  | { type: 'final'; text?: string }
  | { type: 'stopped' }
  | { type: 'error'; error?: string }

export type SttEventSink = (event: SttEvent) => void

type WorkerMessage =
  | {
      type: 'init'
      modelDir: string
      modelType: string
      streaming: boolean
      sampleRate: number
      files: string[]
      hotwordsFilePath?: string
      modelingUnit?: string
    }
  | { type: 'feed'; samples: Float32Array; sampleRate: number }
  | { type: 'stop' }
  | { type: 'teardown' }

export class SttService {
  private worker: ChildProcess | null = null
  private cloudSession: OpenAiTranscriptionSession | null = null
  private modelManager: ModelManager
  private activeModelId: string | null = null
  private activeHotwordsFilePath: string | undefined
  private activeOwner: string | null = null
  private startingOwner: string | null = null
  private startingModelId: string | null = null
  private starting = false
  private canceledOwners = new Set<string>()
  private eventSink: SttEventSink | null = null
  private idleTeardownTimer: NodeJS.Timeout | null = null
  // Why: warm workers intentionally keep lifecycle listeners while reusable;
  // stale workers must not retain this service after error, exit, or teardown.
  private cleanupWorkerLifecycleListeners: (() => void) | null = null

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager
  }

  async startDictation(
    modelId: string,
    sink: SttEventSink,
    hotwordsFilePath?: string,
    owner = 'desktop'
  ): Promise<void> {
    if (this.starting) {
      if (this.startingOwner !== owner) {
        throw new Error('dictation_already_active')
      }
      return
    }
    if ((this.worker || this.cloudSession) && this.activeOwner && this.activeOwner !== owner) {
      throw new Error('dictation_already_active')
    }
    this.starting = true
    this.startingOwner = owner
    this.startingModelId = modelId
    this.clearIdleTeardownTimer()

    try {
      await this._startDictation(modelId, sink, hotwordsFilePath, owner)
      if (this.canceledOwners.delete(owner)) {
        await this.stopDictation(owner, { cancelStarting: false })
        throw new Error('dictation_canceled')
      }
      this.activeOwner = owner
    } finally {
      this.starting = false
      this.startingOwner = null
      this.startingModelId = null
      this.canceledOwners.delete(owner)
    }
  }

  private async _startDictation(
    modelId: string,
    sink: SttEventSink,
    hotwordsFilePath?: string,
    owner = 'desktop'
  ): Promise<void> {
    const manifest = getCatalogModel(modelId)
    if (!manifest) {
      throw new Error(`Unknown model: ${modelId}`)
    }

    if (manifest.provider === 'openai') {
      if (this.worker) {
        await this.stopDictation(owner, { cancelStarting: false })
        await this.teardownIdleWorker()
      }

      const modelState = await this.modelManager.getModelState(modelId)
      if (modelState.status !== 'ready') {
        throw new Error(`Model not ready: ${modelState.status}`)
      }

      this.cloudSession = new OpenAiTranscriptionSession(modelId, readOpenAiSpeechApiKey)
      this.activeModelId = modelId
      this.activeHotwordsFilePath = undefined
      this.eventSink = sink
      sink({ type: 'ready' })
      return
    }

    if (this.cloudSession) {
      await this.stopDictation(owner, { cancelStarting: false })
    }

    if (
      this.worker &&
      this.activeModelId === modelId &&
      this.activeHotwordsFilePath === hotwordsFilePath
    ) {
      this.eventSink = sink
      sink({ type: 'ready' })
      return
    }

    if (this.worker) {
      await this.stopDictation(owner, { cancelStarting: false })
      await this.teardownIdleWorker()
    }

    const modelState = await this.modelManager.getModelState(modelId)
    if (modelState.status !== 'ready') {
      throw new Error(`Model not ready: ${modelState.status}`)
    }

    const workerPath = this.getWorkerPath()
    const sherpaModulePath = this.getSherpaModulePath()

    this.worker = fork(workerPath, [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      serialization: 'advanced',
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        ORCA_STT_SHERPA_MODULE_PATH: sherpaModulePath
      },
      ...(process.platform === 'win32' ? { windowsHide: true } : {})
    })
    const worker = this.worker

    this.activeModelId = modelId
    this.activeHotwordsFilePath = hotwordsFilePath
    this.eventSink = sink

    const readyPromise = new Promise<void>((resolve, reject) => {
      let settled = false
      let startupTimeout: ReturnType<typeof setTimeout> | null = null
      const cleanup = () => {
        if (startupTimeout) {
          clearTimeout(startupTimeout)
          startupTimeout = null
        }
        worker.off('message', onReadyOrError)
        worker.off('error', onStartupError)
        worker.off('exit', onStartupExit)
      }
      const failStartup = (error: Error): void => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        reject(error)
      }
      const onReadyOrError = (msg: { type: string; text?: string; error?: string }) => {
        if (settled) {
          return
        }
        if (msg.type === 'ready') {
          settled = true
          cleanup()
          resolve()
        } else if (msg.type === 'error') {
          failStartup(new Error(msg.error ?? 'Speech worker failed to initialize'))
        }
      }
      const onStartupError = (err: Error) => {
        failStartup(err)
      }
      const onStartupExit = (code: number | null, signal: NodeJS.Signals | null) => {
        const detail = this.formatWorkerExitDetail(code, signal)
        failStartup(new Error(`Speech worker exited before ready: ${detail}`))
      }
      worker.on('message', onReadyOrError)
      worker.on('error', onStartupError)
      worker.on('exit', onStartupExit)
      // Why: a native STT worker can wedge while loading model bindings without
      // emitting ready/error/exit; startup must leave the UI's Starting state.
      startupTimeout = setTimeout(() => {
        failStartup(new Error('Speech worker timed out while starting.'))
      }, START_DICTATION_TIMEOUT_MS)
      startupTimeout.unref?.()
    })

    const onWorkerMessage = (msg: SttEvent) => {
      if (this.worker === worker) {
        this.eventSink?.(msg)
      }
    }

    const onWorkerError = (err: Error) => {
      this.handleWorkerFailure(worker, `Speech worker error: ${String(err)}`)
    }

    const onWorkerExit = (code: number | null, signal: NodeJS.Signals | null) => {
      this.handleWorkerFailure(
        worker,
        `Speech worker exited with ${this.formatWorkerExitDetail(code, signal)}`
      )
    }

    worker.on('message', onWorkerMessage)
    worker.on('error', onWorkerError)
    worker.on('exit', onWorkerExit)
    this.cleanupWorkerLifecycleListeners = () => {
      worker.off('message', onWorkerMessage)
      worker.off('error', onWorkerError)
      worker.off('exit', onWorkerExit)
    }

    const modelDir = this.modelManager.getModelDir(modelId)
    try {
      this.sendWorkerMessage(worker, {
        type: 'init',
        modelDir,
        modelType: manifest.type,
        streaming: manifest.streaming,
        sampleRate: manifest.sampleRate,
        files: manifest.files ?? [],
        hotwordsFilePath,
        modelingUnit: manifest.modelingUnit
      })
      await readyPromise
    } catch (error) {
      this.cleanupActiveWorkerLifecycleListeners()
      worker.removeAllListeners()
      this.killWorker(worker, { ignoreErrors: true })
      if (this.worker === worker) {
        this.worker = null
        this.activeModelId = null
        this.activeHotwordsFilePath = undefined
        this.activeOwner = null
        this.eventSink = null
      }
      throw error
    }
  }

  feedAudio(samples: Float32Array, sampleRate: number, owner = 'desktop'): void {
    const currentOwner = this.activeOwner ?? this.startingOwner
    if (!currentOwner) {
      return
    }
    if (currentOwner !== owner) {
      throw new Error('dictation_owner_mismatch')
    }
    if (this.cloudSession) {
      this.cloudSession.feedAudio(samples, sampleRate)
      return
    }
    const worker = this.worker
    if (!worker) {
      return
    }
    try {
      this.sendWorkerMessage(worker, { type: 'feed', samples, sampleRate })
    } catch (error) {
      this.handleWorkerFailure(
        worker,
        `Speech worker IPC failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async stopDictation(
    owner = 'desktop',
    options: { cancelStarting?: boolean } = { cancelStarting: true }
  ): Promise<void> {
    if (options.cancelStarting !== false && this.startingOwner === owner) {
      this.canceledOwners.add(owner)
    }
    if (!this.worker && !this.cloudSession) {
      return
    }
    const currentOwner = this.activeOwner ?? this.startingOwner
    if (currentOwner && currentOwner !== owner) {
      throw new Error('dictation_owner_mismatch')
    }

    if (this.cloudSession) {
      const session = this.cloudSession
      this.cloudSession = null
      try {
        const text = await session.finish()
        if (text) {
          this.eventSink?.({ type: 'final', text })
        }
      } catch (error) {
        this.eventSink?.({
          type: 'error',
          error: error instanceof Error ? error.message : String(error)
        })
      } finally {
        this.eventSink?.({ type: 'stopped' })
        this.activeModelId = null
        this.activeHotwordsFilePath = undefined
        this.activeOwner = null
        this.eventSink = null
      }
      return
    }

    const worker = this.worker
    if (!worker) {
      return
    }
    try {
      this.sendWorkerMessage(worker, { type: 'stop' })
    } catch (error) {
      this.handleWorkerFailure(
        worker,
        `Speech worker IPC failed: ${error instanceof Error ? error.message : String(error)}`
      )
      return
    }

    let forcedTeardown = false
    await new Promise<void>((resolve) => {
      let settled = false
      let receivedStopped = false
      let timeout: ReturnType<typeof setTimeout> | null = null

      const cleanup = (): void => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        worker.off('message', onStopped)
        worker.off('error', onError)
        worker.off('exit', onExit)
      }

      const finish = (outcome: 'stopped' | 'error' | 'exit' | 'timeout'): void => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        if (outcome !== 'stopped' && !receivedStopped) {
          const message =
            outcome === 'timeout'
              ? 'Speech worker timed out while stopping.'
              : 'Speech worker stopped unexpectedly.'
          this.handleWorkerFailure(worker, message)
          if (outcome === 'timeout') {
            this.killWorker(worker, { ignoreErrors: true })
          }
        }
        resolve()
      }

      const onStopped = (msg: { type: string; text?: string; error?: string }) => {
        if (msg.type === 'stopped') {
          receivedStopped = true
          finish('stopped')
        }
      }

      const onError = () => {
        forcedTeardown = true
        finish('error')
      }

      const onExit = () => {
        forcedTeardown = true
        finish('exit')
      }

      timeout = setTimeout(() => {
        if (settled) {
          return
        }
        forcedTeardown = true
        finish('timeout')
      }, STOP_DICTATION_TIMEOUT_MS)
      timeout.unref?.()

      worker.on('message', onStopped)
      worker.on('error', onError)
      worker.on('exit', onExit)
    })

    if (this.worker === worker) {
      if (forcedTeardown) {
        this.clearWorkerState()
      } else {
        this.activeOwner = null
        this.eventSink = null
        this.scheduleIdleTeardown()
      }
    }
  }

  isActive(): boolean {
    return this.worker !== null || this.cloudSession !== null
  }

  getActiveModelId(): string | null {
    return this.activeModelId
  }

  async prepareModelForDeletion(modelId: string): Promise<void> {
    if (this.startingModelId === modelId || (this.activeOwner && this.activeModelId === modelId)) {
      throw new Error('voice_model_in_use')
    }
    if (this.worker && this.activeModelId === modelId) {
      await this.teardownIdleWorker({ ignoreTerminateErrors: false })
      if (this.worker && this.activeModelId === modelId) {
        throw new Error('voice_model_in_use')
      }
    }
  }

  private getWorkerPath(): string {
    if (app.isPackaged) {
      // Why: forked ELECTRON_RUN_AS_NODE children cannot execute from app.asar;
      // the STT sidecar must be unpacked like other forked main-process helpers.
      return join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'stt-worker.js')
    }
    return join(__dirname, 'stt-worker.js')
  }

  private sendWorkerMessage(worker: ChildProcess, message: WorkerMessage): void {
    if (!worker.send) {
      throw new Error('Speech worker IPC is unavailable')
    }
    worker.send(message)
  }

  private formatWorkerExitDetail(code: number | null, signal: NodeJS.Signals | null): string {
    return signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`
  }

  private handleWorkerFailure(worker: ChildProcess, error: string): void {
    if (this.worker !== worker) {
      return
    }
    const sink = this.eventSink
    this.clearIdleTeardownTimer()
    this.cleanupActiveWorkerLifecycleListeners()
    this.clearWorkerState()
    sink?.({ type: 'error', error })
    sink?.({ type: 'stopped' })
  }

  private clearWorkerState(): void {
    this.worker = null
    this.activeModelId = null
    this.activeHotwordsFilePath = undefined
    this.activeOwner = null
    this.eventSink = null
  }

  private clearIdleTeardownTimer(): void {
    if (this.idleTeardownTimer) {
      clearTimeout(this.idleTeardownTimer)
      this.idleTeardownTimer = null
    }
  }

  private scheduleIdleTeardown(): void {
    this.clearIdleTeardownTimer()
    // Why: keep the native recognizer warm for repeated dictations, but release
    // the ONNX model after a quiet period so long-running Orca sessions don't
    // pin speech memory forever.
    this.idleTeardownTimer = setTimeout(() => {
      void this.teardownIdleWorker()
    }, IDLE_WORKER_TEARDOWN_MS)
    this.idleTeardownTimer.unref?.()
  }

  private async teardownIdleWorker(
    options: { ignoreTerminateErrors?: boolean } = { ignoreTerminateErrors: true }
  ): Promise<void> {
    this.clearIdleTeardownTimer()
    if (!this.worker || this.activeOwner || this.startingOwner) {
      return
    }
    const worker = this.worker
    try {
      this.sendWorkerMessage(worker, { type: 'teardown' })
      this.killWorker(worker, { ignoreErrors: options.ignoreTerminateErrors ?? true })
    } catch (error) {
      if (!options.ignoreTerminateErrors) {
        throw error
      }
    }
    this.cleanupActiveWorkerLifecycleListeners()
    worker.removeAllListeners()
    if (this.worker === worker) {
      this.worker = null
      this.activeModelId = null
      this.activeHotwordsFilePath = undefined
      this.eventSink = null
    }
  }

  private killWorker(
    worker: ChildProcess,
    options: { ignoreErrors?: boolean } = { ignoreErrors: true }
  ): void {
    try {
      if (worker.killed) {
        return
      }
      const signaled = worker.kill('SIGTERM')
      if (!signaled && !options.ignoreErrors) {
        throw new Error('Speech worker did not accept SIGTERM')
      }
    } catch (error) {
      if (!options.ignoreErrors) {
        throw error
      }
    }
  }

  private cleanupActiveWorkerLifecycleListeners(): void {
    const cleanup = this.cleanupWorkerLifecycleListeners
    this.cleanupWorkerLifecycleListeners = null
    cleanup?.()
  }

  private getSherpaModulePath(): string {
    // Why: the main sherpa-onnx npm package uses WASM, which cannot access
    // the host filesystem to load model files. The platform-specific native
    // addon (e.g. sherpa-onnx-darwin-arm64) has direct filesystem access
    // and better performance. We resolve its absolute path here because
    // the worker runs from out/main/ where bare require() can't find it.
    const nativePkg =
      process.platform === 'win32' && process.arch === 'x64'
        ? 'sherpa-onnx-win-x64'
        : `sherpa-onnx-${process.platform}-${process.arch}`

    if (app.isPackaged) {
      const resourcesNodeModule = join(process.resourcesPath, 'node_modules', nativePkg)
      if (existsSync(resourcesNodeModule)) {
        return resourcesNodeModule
      }
      return join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', nativePkg)
    }

    const resolved = require.resolve(nativePkg)
    return join(resolved, '..')
  }
}
