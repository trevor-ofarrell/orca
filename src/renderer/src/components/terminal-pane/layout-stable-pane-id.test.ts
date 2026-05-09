import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { replayTerminalLayout, serializeTerminalLayout } from './layout-serialization'

class MockHTMLElement {
  classList: { contains: (cls: string) => boolean }
  dataset: Record<string, string>
  children: MockHTMLElement[]
  style: Record<string, string>
  firstElementChild: MockHTMLElement | null

  constructor(opts: {
    classList?: string[]
    dataset?: Record<string, string>
    children?: MockHTMLElement[]
    style?: Record<string, string>
    firstElementChild?: MockHTMLElement | null
  }) {
    const classes = opts.classList ?? []
    this.classList = { contains: (cls: string) => classes.includes(cls) }
    this.dataset = opts.dataset ?? {}
    this.children = opts.children ?? []
    this.style = opts.style ?? {}
    this.firstElementChild = opts.firstElementChild ?? null
  }
}

let originalHTMLElement: unknown

beforeAll(() => {
  const globalRecord = globalThis as unknown as Record<string, unknown>
  originalHTMLElement = globalRecord.HTMLElement
  globalRecord.HTMLElement = MockHTMLElement
})

afterAll(() => {
  const globalRecord = globalThis as unknown as Record<string, unknown>
  if (originalHTMLElement === undefined) {
    delete globalRecord.HTMLElement
  } else {
    globalRecord.HTMLElement = originalHTMLElement
  }
})

function mockElement(opts: {
  classList?: string[]
  dataset?: Record<string, string>
  children?: MockHTMLElement[]
  style?: Record<string, string>
  firstElementChild?: MockHTMLElement | null
}): HTMLElement {
  return new MockHTMLElement(opts) as unknown as HTMLElement
}

describe('layout stablePaneId persistence', () => {
  it('keeps stablePaneId attached to pane leaf ids when pane DOM order changes', () => {
    const leaf1 = new MockHTMLElement({ classList: ['pane'], dataset: { paneId: '1' } })
    const leaf2 = new MockHTMLElement({ classList: ['pane'], dataset: { paneId: '2' } })
    const stableMap = new Map<number, string>([
      [1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      [2, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
    ])

    const originalSplit = new MockHTMLElement({
      classList: ['pane-split'],
      children: [leaf1, leaf2]
    })
    const movedSplit = new MockHTMLElement({
      classList: ['pane-split'],
      children: [leaf2, leaf1]
    })

    const original = serializeTerminalLayout(
      mockElement({ firstElementChild: originalSplit }) as unknown as HTMLDivElement,
      1,
      null,
      stableMap
    )
    const moved = serializeTerminalLayout(
      mockElement({ firstElementChild: movedSplit }) as unknown as HTMLDivElement,
      1,
      null,
      stableMap
    )

    // Why: drag-moving panes changes visual/tree order, not pane identity.
    // UUIDs must follow the pane leaf id (`pane:N`), not the leaf's position.
    expect(original.stablePaneIdByLeafId).toEqual(moved.stablePaneIdByLeafId)
    expect(moved.root).toEqual({
      type: 'split',
      direction: 'vertical',
      first: { type: 'leaf', leafId: 'pane:2' },
      second: { type: 'leaf', leafId: 'pane:1' }
    })
  })

  it('reattaches snapshot UUIDs to the original leaves even when numeric ids are reassigned', () => {
    const adopted: [number, string][] = []
    let nextPaneId = 1
    const manager = {
      createInitialPane: () => ({ id: nextPaneId++ }),
      splitPane: () => ({ id: nextPaneId++ }),
      adoptStablePaneId: (numericId: number, stablePaneId: string) => {
        adopted.push([numericId, stablePaneId])
      }
    }

    const snapshot = {
      root: {
        type: 'split',
        direction: 'vertical',
        first: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', leafId: 'leaf-a' },
          second: { type: 'leaf', leafId: 'leaf-b' }
        },
        second: { type: 'leaf', leafId: 'leaf-c' }
      },
      activeLeafId: 'leaf-b',
      expandedLeafId: null,
      stablePaneIdByLeafId: {
        'leaf-a': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'leaf-b': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'leaf-c': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      }
    } satisfies Parameters<typeof replayTerminalLayout>[1]

    const paneByLeafId = replayTerminalLayout(
      manager as unknown as Parameters<typeof replayTerminalLayout>[0],
      snapshot,
      false
    )

    // Why: replay creates panes in split traversal order (`a`, `c`, `b` here),
    // so numeric ids can move. Persisted UUIDs must still restore by leaf id.
    expect(Object.fromEntries(paneByLeafId)).toEqual({
      'leaf-a': 1,
      'leaf-c': 2,
      'leaf-b': 3
    })
    expect(adopted).toEqual([
      [1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      [3, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      [2, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']
    ])
  })
})
