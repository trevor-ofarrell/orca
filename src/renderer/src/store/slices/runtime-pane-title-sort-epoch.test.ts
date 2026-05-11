import { describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock('@/runtime/sync-runtime-graph', () => ({
  scheduleRuntimeGraphSync: vi.fn()
}))
vi.mock('@/components/terminal-pane/pty-transport', () => ({
  registerEagerPtyBuffer: vi.fn(),
  ensurePtyDispatcher: vi.fn(),
  unregisterPtyDataHandlers: vi.fn()
}))
vi.mock('@/components/terminal-pane/shutdown-buffer-captures', () => ({
  shutdownBufferCaptures: vi.fn()
}))

// @ts-expect-error -- minimal preload API stub for the slice's IPC writes
globalThis.window = { api: {} }

import { createTestStore } from './store-test-helpers'

describe('runtimePaneTitle → sortEpoch', () => {
  it('bumps sortEpoch when the new title classifies differently than the previous title', () => {
    // Why: smart sort's title-heuristic fallback (Edge case 9) reads
    // runtimePaneTitlesByTabId. A hookless agent transitioning from
    // 'working' to 'permission' must trigger a re-sort.
    const store = createTestStore()
    const before = store.getState().sortEpoch
    store.getState().setRuntimePaneTitle('tab-1', 1, '⠋ Claude')
    const afterWorking = store.getState().sortEpoch
    expect(afterWorking).toBeGreaterThan(before)
    store.getState().setRuntimePaneTitle('tab-1', 1, '✋ Gemini CLI')
    expect(store.getState().sortEpoch).toBeGreaterThan(afterWorking)
  })

  it('does not bump sortEpoch when the classification is unchanged', () => {
    // Why: incidental title noise (spinner frame, prompt suffix) shouldn't
    // churn the sidebar order.
    const store = createTestStore()
    store.getState().setRuntimePaneTitle('tab-1', 1, '⠋ Claude')
    const baseline = store.getState().sortEpoch
    // Spinner frame change — still classifies as 'working'.
    store.getState().setRuntimePaneTitle('tab-1', 1, '⠙ Claude')
    expect(store.getState().sortEpoch).toBe(baseline)
  })

  it('bumps sortEpoch when clearing a classified title back to none', () => {
    const store = createTestStore()
    store.getState().setRuntimePaneTitle('tab-1', 1, '✋ Gemini CLI')
    const baseline = store.getState().sortEpoch
    store.getState().clearRuntimePaneTitle('tab-1', 1)
    expect(store.getState().sortEpoch).toBeGreaterThan(baseline)
  })
})
