/* oxlint-disable typescript-eslint/no-explicit-any -- sherpa-onnx native addon has no type definitions */
import {
  createOfflineDecodeSegments,
  LOCAL_OFFLINE_MAX_AUDIO_SECONDS,
  offlineAudioExceedsLimit
} from './stt-offline-decode-plan'
import { resampleToRate } from './stt-audio-resample'
import { discoverBpeVocab, resolveFile, resolveTokens } from './stt-worker-model-files'

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

// Why: the main sherpa-onnx npm package uses WASM which cannot access the host
// filesystem to load model files. We use the platform-specific native addon
// (e.g. sherpa-onnx-darwin-arm64) which has a flat C-style API and direct
// filesystem access. The main thread resolves the correct absolute path
// (dev vs packaged) and passes it via the forked sidecar environment.
let sherpa: any = null
let recognizer: any = null
let stream: any = null
let isStreaming = false
let offlineBuffer: Float32Array[] = []
let offlineBufferedSamples = 0
let offlineLimitExceeded = false
let offlineSampleRate = 16000

const sherpaModulePathEnv = 'ORCA_STT_SHERPA_MODULE_PATH'
const localOfflineLimitMinutes = Math.floor(LOCAL_OFFLINE_MAX_AUDIO_SECONDS / 60)

function loadSherpa(): any {
  const modulePath = process.env[sherpaModulePathEnv]
  if (!modulePath) {
    throw new Error(`${sherpaModulePathEnv} is required`)
  }
  return require(modulePath)
}

function postToParent(message: { type: string; text?: string; error?: string }): void {
  process.send?.(message)
}

function buildHotwordsConfig(msg: Extract<WorkerMessage, { type: 'init' }>): {
  decodingMethod: string
  hotwordsFile?: string
  hotwordsScore?: number
  modelingUnit?: string
  bpeVocab?: string
} {
  if (msg.modelType !== 'transducer' || !msg.hotwordsFilePath) {
    return { decodingMethod: 'greedy_search' }
  }

  const unit = msg.modelingUnit
  if (unit?.includes('bpe')) {
    const bpeVocab = discoverBpeVocab(msg.modelDir)
    if (!bpeVocab) {
      return { decodingMethod: 'greedy_search' }
    }
    return {
      decodingMethod: 'modified_beam_search',
      hotwordsFile: msg.hotwordsFilePath,
      hotwordsScore: 1.5,
      modelingUnit: unit,
      bpeVocab
    }
  }

  return {
    decodingMethod: 'modified_beam_search',
    hotwordsFile: msg.hotwordsFilePath,
    hotwordsScore: 1.5,
    modelingUnit: unit
  }
}

function handleInit(msg: Extract<WorkerMessage, { type: 'init' }>): void {
  try {
    sherpa = loadSherpa()

    const { modelDir, modelType, streaming, sampleRate, files } = msg
    isStreaming = streaming
    offlineBuffer = []
    offlineBufferedSamples = 0
    offlineLimitExceeded = false
    offlineSampleRate = sampleRate

    const tokens = resolveTokens(files, modelDir)
    const hotwords = buildHotwordsConfig(msg)

    if (streaming && modelType === 'transducer') {
      const config = {
        featConfig: { sampleRate, featureDim: 80 },
        modelConfig: {
          transducer: {
            encoder: resolveFile(files, 'encoder', modelDir),
            decoder: resolveFile(files, 'decoder', modelDir),
            joiner: resolveFile(files, 'joiner', modelDir)
          },
          tokens,
          numThreads: 1,
          provider: 'cpu',
          debug: 0
        },
        ...hotwords,
        enableEndpoint: 1,
        rule1MinTrailingSilence: 2.4,
        rule2MinTrailingSilence: 1.2,
        rule3MinUtteranceLength: 20
      }
      recognizer = sherpa.createOnlineRecognizer(config)
      stream = sherpa.createOnlineStream(recognizer)
    } else if (streaming && modelType === 'paraformer') {
      const config = {
        featConfig: { sampleRate, featureDim: 80 },
        modelConfig: {
          paraformer: {
            encoder: resolveFile(files, 'encoder', modelDir),
            decoder: resolveFile(files, 'decoder', modelDir)
          },
          tokens,
          numThreads: 1,
          provider: 'cpu',
          debug: 0
        },
        decodingMethod: 'greedy_search',
        enableEndpoint: 1,
        rule1MinTrailingSilence: 2.4,
        rule2MinTrailingSilence: 1.2,
        rule3MinUtteranceLength: 20
      }
      recognizer = sherpa.createOnlineRecognizer(config)
      stream = sherpa.createOnlineStream(recognizer)
    } else if (modelType === 'whisper') {
      const config = {
        featConfig: { sampleRate, featureDim: 80 },
        modelConfig: {
          whisper: {
            encoder: resolveFile(files, 'encoder', modelDir),
            decoder: resolveFile(files, 'decoder', modelDir)
          },
          tokens,
          numThreads: 2,
          provider: 'cpu',
          debug: 0
        },
        decodingMethod: 'greedy_search'
      }
      recognizer = sherpa.createOfflineRecognizer(config)
      stream = sherpa.createOfflineStream(recognizer)
    } else {
      const config = {
        featConfig: { sampleRate, featureDim: 80 },
        modelConfig: {
          transducer: {
            encoder: resolveFile(files, 'encoder', modelDir),
            decoder: resolveFile(files, 'decoder', modelDir),
            joiner: resolveFile(files, 'joiner', modelDir)
          },
          tokens,
          numThreads: 2,
          provider: 'cpu',
          debug: 0
        },
        ...hotwords
      }
      recognizer = sherpa.createOfflineRecognizer(config)
      stream = sherpa.createOfflineStream(recognizer)
    }

    postToParent({ type: 'ready' })
  } catch (err) {
    postToParent({ type: 'error', error: String(err) })
  }
}

function handleFeed(msg: Extract<WorkerMessage, { type: 'feed' }>): void {
  if (!recognizer || !stream) {
    return
  }

  try {
    const inputRate = msg.sampleRate || offlineSampleRate
    // Why: sherpa's native stream aborts the process if one recognizer sees
    // different input rates across chunks. Normalize before crossing the
    // native boundary so device/context changes become recoverable JS state.
    const samples = resampleToRate(msg.samples, inputRate, offlineSampleRate)
    if (isStreaming) {
      sherpa.acceptWaveformOnline(stream, { sampleRate: offlineSampleRate, samples })

      while (sherpa.isOnlineStreamReady(recognizer, stream)) {
        sherpa.decodeOnlineStream(recognizer, stream)
      }

      const resultJson = sherpa.getOnlineStreamResultAsJson(recognizer, stream)
      const result = JSON.parse(resultJson)
      const text = result?.text?.trim()
      if (text) {
        postToParent({ type: 'partial', text })
      }

      if (sherpa.isEndpoint(recognizer, stream)) {
        const finalText = result?.text?.trim()
        if (finalText) {
          postToParent({ type: 'final', text: finalText })
        }
        sherpa.reset(recognizer, stream)
      }
    } else {
      if (offlineLimitExceeded) {
        return
      }
      const nextBufferedSamples = offlineBufferedSamples + samples.length
      if (offlineAudioExceedsLimit(nextBufferedSamples, offlineSampleRate)) {
        offlineLimitExceeded = true
        offlineBuffer = []
        offlineBufferedSamples = 0
        postToParent({
          type: 'error',
          error: `Local offline dictation is limited to ${localOfflineLimitMinutes} minutes.`
        })
        return
      }
      // Why: offline recognizers cannot emit useful partials. Buffer audio, then
      // decode bounded segments on stop so native ONNX allocations stay capped.
      offlineBuffer.push(new Float32Array(samples))
      offlineBufferedSamples = nextBufferedSamples
    }
  } catch (err) {
    postToParent({ type: 'error', error: String(err) })
  }
}

function decodeOfflineSegments(): void {
  if (offlineLimitExceeded || offlineBufferedSamples === 0) {
    return
  }

  const textSegments: string[] = []
  for (const segment of createOfflineDecodeSegments(offlineBuffer, offlineSampleRate)) {
    const segmentStream = sherpa.createOfflineStream(recognizer)
    sherpa.acceptWaveformOffline(segmentStream, { sampleRate: offlineSampleRate, samples: segment })
    sherpa.decodeOfflineStream(recognizer, segmentStream)
    const resultJson = sherpa.getOfflineStreamResultAsJson(segmentStream)
    const result = JSON.parse(resultJson)
    const text = result?.text?.trim()
    if (text) {
      textSegments.push(text)
    }
  }

  const finalText = textSegments.join(' ').trim()
  if (finalText) {
    postToParent({ type: 'final', text: finalText })
  }
}

function resetOfflineState(): void {
  offlineBuffer = []
  offlineBufferedSamples = 0
  offlineLimitExceeded = false
  stream = sherpa.createOfflineStream(recognizer)
}

function handleStop(): void {
  if (!recognizer || !stream) {
    postToParent({ type: 'stopped' })
    return
  }

  try {
    if (isStreaming) {
      sherpa.inputFinished(stream)
      while (sherpa.isOnlineStreamReady(recognizer, stream)) {
        sherpa.decodeOnlineStream(recognizer, stream)
      }
      const resultJson = sherpa.getOnlineStreamResultAsJson(recognizer, stream)
      const result = JSON.parse(resultJson)
      const text = result?.text?.trim()
      if (text) {
        postToParent({ type: 'final', text })
      }
      stream = sherpa.createOnlineStream(recognizer)
    } else {
      decodeOfflineSegments()
      resetOfflineState()
    }
  } catch (err) {
    offlineBuffer = []
    offlineBufferedSamples = 0
    offlineLimitExceeded = false
    if (!isStreaming && sherpa && recognizer) {
      stream = sherpa.createOfflineStream(recognizer)
    }
    postToParent({ type: 'error', error: String(err) })
  }

  postToParent({ type: 'stopped' })
}

function handleTeardown(): void {
  stream = null
  recognizer = null
  sherpa = null
  offlineBuffer = []
  offlineBufferedSamples = 0
  offlineLimitExceeded = false
  process.exit(0)
}

process.on('message', (msg: WorkerMessage) => {
  switch (msg.type) {
    case 'init':
      handleInit(msg)
      break
    case 'feed':
      handleFeed(msg)
      break
    case 'stop':
      handleStop()
      break
    case 'teardown':
      handleTeardown()
      break
  }
})
