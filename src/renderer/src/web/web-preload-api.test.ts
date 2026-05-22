/* eslint-disable max-lines -- Why: web preload parity tests share module-reset
global setup across namespaces so browser API installation stays realistic. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreloadApi } from '../../../preload/api-types'
import type { RuntimeRpcResponse } from '../../../shared/runtime-rpc-envelope'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function installBrowserGlobals(userAgent = 'Linux'): {
  window: Window & typeof globalThis
  storage: MemoryStorage
} {
  const storage = new MemoryStorage()
  const windowStub = {
    localStorage: storage,
    location: {
      protocol: 'http:',
      reload: vi.fn()
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    btoa: (value: string) => Buffer.from(value, 'binary').toString('base64')
  } as unknown as Window & typeof globalThis
  vi.stubGlobal('window', windowStub)
  vi.stubGlobal('navigator', { userAgent, hardwareConcurrency: 8 })
  return { window: windowStub, storage }
}

async function installApi(userAgent?: string): Promise<{
  api: PreloadApi
  storage: MemoryStorage
  window: Window & typeof globalThis
}> {
  const globals = installBrowserGlobals(userAgent)
  const { installWebPreloadApi } = await import('./web-preload-api')
  installWebPreloadApi()
  return {
    api: globals.window.api,
    storage: globals.storage,
    window: globals.window
  }
}

function writeStoredRuntimeEnvironment(storage: Storage): void {
  storage.setItem(
    'orca.web.runtimeEnvironment.v1',
    JSON.stringify({
      id: 'web-env-1',
      name: 'Test runtime',
      createdAt: 1,
      updatedAt: 1,
      lastUsedAt: null,
      runtimeId: null,
      preferredEndpointId: 'ws-web-env-1',
      endpoints: [
        {
          id: 'ws-web-env-1',
          kind: 'websocket',
          label: 'WebSocket',
          endpoint: 'ws://127.0.0.1:1234',
          deviceToken: 'token',
          publicKeyB64: 'public-key'
        }
      ]
    })
  )
}

describe('web keybindings preload API', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns snapshots and persists customized bindings in browser storage', async () => {
    const { api, storage } = await installApi('Linux')

    const initial = await api.keybindings.get()
    expect(initial.platform).toBe('linux')
    expect(initial.overrides).toEqual({})

    const updated = await api.keybindings.setAction({
      actionId: 'worktree.palette',
      bindings: ['Ctrl+Alt+J']
    })

    expect(updated.overrides['worktree.palette']).toEqual(['Ctrl+Alt+J'])
    expect(storage.getItem('orca.web.keybindings.v1')).toContain('worktree.palette')

    const disabled = await api.keybindings.setAction({
      actionId: 'worktree.palette',
      bindings: []
    })
    expect(disabled.overrides['worktree.palette']).toEqual([])

    const reset = await api.keybindings.setAction({
      actionId: 'worktree.palette',
      bindings: null
    })
    expect(reset.overrides['worktree.palette']).toBeUndefined()
  })

  it('rejects conflicts before mutating browser storage', async () => {
    const { api } = await installApi('Linux')

    await api.keybindings.setAction({
      actionId: 'worktree.palette',
      bindings: ['Ctrl+Alt+J']
    })

    await expect(
      api.keybindings.setAction({
        actionId: 'worktree.quickOpen',
        bindings: ['Ctrl+Alt+J']
      })
    ).rejects.toThrow('conflicts')

    const snapshot = await api.keybindings.get()
    expect(snapshot.overrides['worktree.palette']).toEqual(['Ctrl+Alt+J'])
    expect(snapshot.overrides['worktree.quickOpen']).toBeUndefined()
  })

  it('notifies listeners when web keybindings change', async () => {
    const { api } = await installApi('Linux')
    const listener = vi.fn()
    const unsubscribe = api.keybindings.onChanged(listener)

    await api.keybindings.setAction({
      actionId: 'worktree.palette',
      bindings: ['Ctrl+Alt+J']
    })

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        overrides: expect.objectContaining({ 'worktree.palette': ['Ctrl+Alt+J'] })
      })
    )

    unsubscribe()
  })
})

describe('web GitLab preload API', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('./web-runtime-client')
    vi.doUnmock('electron')
  })

  it('keeps the web GitLab preload key set in parity with desktop preload', async () => {
    vi.doMock('electron', () => ({
      ipcRenderer: { invoke: vi.fn() }
    }))
    const globals = installBrowserGlobals('Linux')
    const preloadModulePath = new URL('../../../preload/gitlab.ts', import.meta.url).pathname
    const { glApi } = (await import(preloadModulePath)) as { glApi: Record<string, unknown> }
    const { installWebPreloadApi } = await import('./web-preload-api')

    installWebPreloadApi()

    expect(Object.keys(globals.window.api.gl).sort()).toEqual(Object.keys(glApi).sort())
  })

  it('routes every runtime-backed GitLab method through the expected RPC method', async () => {
    type GitLabApi = NonNullable<PreloadApi['gl']>
    const runtimeCalls: { method: string; params: unknown }[] = []
    vi.doMock('./web-runtime-client', () => ({
      WebRuntimeClient: class {
        call(method: string, params?: unknown): Promise<RuntimeRpcResponse<unknown>> {
          runtimeCalls.push({ method, params })
          return Promise.resolve({
            id: `call-${runtimeCalls.length}`,
            ok: true,
            result: { ok: true, items: [] },
            _meta: { runtimeId: 'runtime-1' }
          })
        }

        close(): void {}
      }
    }))

    const globals = installBrowserGlobals('Linux')
    writeStoredRuntimeEnvironment(globals.storage)
    const { installWebPreloadApi } = await import('./web-preload-api')
    installWebPreloadApi()
    const api = globals.window.api
    const repoPath = '/workspace/repo'

    const routeCases: {
      invoke: (gl: GitLabApi) => Promise<unknown>
      expectedMethod: string
      expectedParams: unknown
    }[] = [
      {
        invoke: (gl) => gl.listMRs({ repoPath, state: 'opened', page: 1, perPage: 50 }),
        expectedMethod: 'gitlab.listMRs',
        expectedParams: { repoPath, repo: repoPath, state: 'opened', page: 1, perPage: 50 }
      },
      {
        invoke: (gl) => gl.listWorkItems({ repoPath, state: 'closed', page: 2, perPage: 25 }),
        expectedMethod: 'gitlab.listWorkItems',
        expectedParams: { repoPath, repo: repoPath, state: 'closed', page: 2, perPage: 25 }
      },
      {
        invoke: (gl) => gl.listIssues({ repoPath, state: 'all', assignee: '@me', limit: 30 }),
        expectedMethod: 'gitlab.listIssues',
        expectedParams: { repoPath, repo: repoPath, state: 'all', assignee: '@me', limit: 30 }
      },
      {
        invoke: (gl) => gl.createIssue({ repoPath, title: 'Bug', body: 'Details' }),
        expectedMethod: 'gitlab.createIssue',
        expectedParams: { repoPath, repo: repoPath, title: 'Bug', body: 'Details' }
      },
      {
        invoke: (gl) => gl.updateIssue({ repoPath, number: 7, updates: { state: 'closed' } }),
        expectedMethod: 'gitlab.updateIssue',
        expectedParams: { repoPath, repo: repoPath, number: 7, updates: { state: 'closed' } }
      },
      {
        invoke: (gl) => gl.addIssueComment({ repoPath, number: 7, body: 'Fixed' }),
        expectedMethod: 'gitlab.addIssueComment',
        expectedParams: { repoPath, repo: repoPath, number: 7, body: 'Fixed' }
      },
      {
        invoke: (gl) => gl.todos({ repoPath }),
        expectedMethod: 'gitlab.todos',
        expectedParams: { repoPath, repo: repoPath }
      },
      {
        invoke: (gl) => gl.workItemDetails({ repoPath, iid: 8, type: 'mr' }),
        expectedMethod: 'gitlab.workItemDetails',
        expectedParams: { repoPath, repo: repoPath, iid: 8, type: 'mr' }
      },
      {
        invoke: (gl) => gl.closeMR({ repoPath, iid: 8 }),
        expectedMethod: 'gitlab.updateMRState',
        expectedParams: { repoPath, repo: repoPath, iid: 8, state: 'closed' }
      },
      {
        invoke: (gl) => gl.reopenMR({ repoPath, iid: 8 }),
        expectedMethod: 'gitlab.updateMRState',
        expectedParams: { repoPath, repo: repoPath, iid: 8, state: 'opened' }
      },
      {
        invoke: (gl) => gl.mergeMR({ repoPath, iid: 8, method: 'squash' }),
        expectedMethod: 'gitlab.mergeMR',
        expectedParams: { repoPath, repo: repoPath, iid: 8, method: 'squash' }
      },
      {
        invoke: (gl) => gl.addMRComment({ repoPath, iid: 8, body: 'Ship it' }),
        expectedMethod: 'gitlab.addMRComment',
        expectedParams: { repoPath, repo: repoPath, iid: 8, body: 'Ship it' }
      },
      {
        invoke: (gl) =>
          gl.workItemByPath({
            repoPath,
            host: 'gitlab.example.com',
            path: 'group/project',
            iid: 7,
            type: 'issue'
          }),
        expectedMethod: 'gitlab.workItemByPath',
        expectedParams: {
          repoPath,
          repo: repoPath,
          host: 'gitlab.example.com',
          path: 'group/project',
          iid: 7,
          type: 'issue'
        }
      }
    ]

    for (const routeCase of routeCases) {
      await routeCase.invoke(api.gl)
    }

    expect(runtimeCalls).toEqual(
      routeCases.map((routeCase) => ({
        method: routeCase.expectedMethod,
        params: routeCase.expectedParams
      }))
    )
  })

  it('exposes the GitLab task methods used by the shared Tasks page', async () => {
    const runtimeCalls: { method: string; params: unknown }[] = []
    vi.doMock('./web-runtime-client', () => ({
      WebRuntimeClient: class {
        call(method: string, params?: unknown): Promise<RuntimeRpcResponse<unknown>> {
          runtimeCalls.push({ method, params })
          if (method === 'gitlab.listMRs') {
            return Promise.resolve({
              id: `call-${runtimeCalls.length}`,
              ok: true,
              result: {
                items: [{ id: 'mr-1', type: 'mr', number: 1 }]
              },
              _meta: { runtimeId: 'runtime-1' }
            })
          }
          if (method === 'gitlab.listIssues') {
            return Promise.resolve({
              id: `call-${runtimeCalls.length}`,
              ok: true,
              result: {
                items: [{ id: 'issue-2', type: 'issue', number: 2 }]
              },
              _meta: { runtimeId: 'runtime-1' }
            })
          }
          if (method === 'gitlab.workItemByPath') {
            return Promise.resolve({
              id: `call-${runtimeCalls.length}`,
              ok: true,
              result: { id: 'issue-7', type: 'issue', number: 7 },
              _meta: { runtimeId: 'runtime-1' }
            })
          }
          return Promise.resolve({
            id: `call-${runtimeCalls.length}`,
            ok: true,
            result: { ok: true },
            _meta: { runtimeId: 'runtime-1' }
          })
        }

        close(): void {}
      }
    }))

    const globals = installBrowserGlobals('Linux')
    writeStoredRuntimeEnvironment(globals.storage)
    const { installWebPreloadApi } = await import('./web-preload-api')
    installWebPreloadApi()
    const api = globals.window.api

    const mergeRequests = await api.gl.listMRs({
      repoPath: '/workspace/repo',
      state: 'opened',
      page: 1,
      perPage: 50
    })
    const issues = await api.gl.listIssues({
      repoPath: '/workspace/repo',
      state: 'opened',
      assignee: '@me',
      limit: 50
    })
    const item = await api.gl.workItemByPath({
      repoPath: '/workspace/repo',
      host: 'gitlab.example.com',
      path: 'group/project',
      iid: 7,
      type: 'issue'
    })
    await api.gl.closeMR({ repoPath: '/workspace/repo', iid: 7 })

    expect(mergeRequests.items).toEqual([{ id: 'mr-1', type: 'mr', number: 1 }])
    expect(issues.items).toEqual([{ id: 'issue-2', type: 'issue', number: 2 }])
    expect(item).toEqual({ id: 'issue-7', type: 'issue', number: 7 })
    expect(runtimeCalls.map((call) => call.method)).not.toContain('gitlab.listWorkItems')
    expect(runtimeCalls).toEqual([
      {
        method: 'gitlab.listMRs',
        params: {
          repoPath: '/workspace/repo',
          repo: '/workspace/repo',
          state: 'opened',
          page: 1,
          perPage: 50
        }
      },
      {
        method: 'gitlab.listIssues',
        params: {
          repoPath: '/workspace/repo',
          repo: '/workspace/repo',
          state: 'opened',
          assignee: '@me',
          limit: 50
        }
      },
      {
        method: 'gitlab.workItemByPath',
        params: {
          repoPath: '/workspace/repo',
          repo: '/workspace/repo',
          host: 'gitlab.example.com',
          path: 'group/project',
          iid: 7,
          type: 'issue'
        }
      },
      {
        method: 'gitlab.updateMRState',
        params: {
          repoPath: '/workspace/repo',
          repo: '/workspace/repo',
          iid: 7,
          state: 'closed'
        }
      }
    ])
  })
})
