# Per-Workspace Right Sidebar Tab

## Problem

- `RightSidebarInner` reads one global `rightSidebarTab` and writes activity-bar clicks through `setRightSidebarTab` (`src/renderer/src/components/right-sidebar/index.tsx`).
- The editor slice stores only one tab value (`src/renderer/src/store/slices/editor.ts`).
- `setActiveWorktree` restores per-worktree editor/browser/terminal/tab-group state, but does not restore right-sidebar tab state (`src/renderer/src/store/slices/worktrees.ts`).

Result: switching worktrees leaks the previous worktree's activity-tab selection.

## Scope

- Keep right-sidebar open/closed, width, and activity-bar position global.
- Keep right-sidebar panels mounted across worktree switches (no remount regression).
- Fix in-session renderer behavior only; do not introduce new main-process persistence.

## Design

1. Add `rightSidebarTabByWorktree: Record<string, RightSidebarTab>` to `EditorSlice`.
- Initialize to `{}` near `rightSidebarTab`.
- Keep `rightSidebarTab` as the render-facing tab used by `RightSidebarInner`.

2. Make `setRightSidebarTab` update both global selection and active-worktree memory.
- If `activeWorktreeId` exists: update `rightSidebarTab` and `rightSidebarTabByWorktree[activeWorktreeId]` in one `set`.
- If no active worktree: update only `rightSidebarTab`.
- Why: no-worktree UI state should not be backfilled into any worktree record.

3. Update `revealInExplorer(worktreeId, filePath)` to also set `rightSidebarTabByWorktree[worktreeId] = 'explorer'`.
- Keep existing behavior (`rightSidebarOpen: true`, `rightSidebarTab: 'explorer'`, pending reveal).
- This avoids stale remembered tabs when reveal targets a non-active worktree.

4. Restore sidebar tab inside `setActiveWorktree` in the same atomic `set`.
- Compute `restoredRightSidebarTab = s.rightSidebarTabByWorktree[worktreeId] ?? 'explorer'`.
- Include `rightSidebarTab: restoredRightSidebarTab` in the returned activation object.
- Do not add a second `set`; that would briefly render the previous worktree's tab.
- Only restore when `worktreeId` is truthy. `setActiveWorktree(null)` should not rewrite `rightSidebarTab`.

5. Purge per-worktree sidebar memory in `purgeWorktreeTerminalState`.
- Add `rightSidebarTabByWorktree: omitByWorktree(s.rightSidebarTabByWorktree)` beside other worktree-scoped editor maps.

6. Also purge on external worktree-list mutations in `fetchWorktrees`.
- `removeWorktree` and hydration-time purge already call `purgeWorktreeTerminalState`, but a plain `fetchWorktrees(repoId)` refresh currently only replaces `worktreesByRepo`.
- If a worktree disappears out-of-band (CLI/git), stale per-worktree maps survive indefinitely.
- In the same state transition that commits the refreshed repo list, compute removed IDs for that repo (`previousIds - nextIds`) and purge those IDs.
- Keep the existing “do not replace non-empty cache with transient empty list” guard; only purge when a real non-transient removal is observed.
- Do not purge from a stale response that was not committed. Purge must derive from the exact list written to `worktreesByRepo`.

## Consistency / Concurrency

- Single-window correctness: atomic updates in `setRightSidebarTab` and `setActiveWorktree` prevent transient mixed state.
- Multi-window: this state remains renderer-local; other windows will not mirror tab changes until they switch worktrees in their own store. This is acceptable for current scope.
- External worktree deletion/refresh: cleanup is **not** fully centralized today; `fetchWorktrees` can observe deletions without purging per-worktree maps. Add the explicit purge hook in `fetchWorktrees` (Design step 6) to close this leak.
- Hidden-tab fallback for folder repos and ordinary visibility changes must stay render-only via `effectiveTab`; do not overwrite remembered value when a tab is temporarily hidden.
- Ports disconnect grace is different: after the grace window expires, the existing timer must still move the active worktree to Explorer so the grace state does not restart indefinitely while `rightSidebarTab === 'ports'`.
- Known existing race (unchanged by this doc): overlapping `fetchWorktrees` responses can still reorder state if older responses arrive late. This design must not add any extra race window beyond current behavior.

## Required Tests

1. `editor.test.ts`
- `setRightSidebarTab` writes active-worktree entry.
- `setRightSidebarTab` with no active worktree does not mutate map.
- `revealInExplorer` records `'explorer'` for target worktree.

2. `store-cascades.test.ts`
- A→B→A activation restores remembered tab per worktree.
- New worktree with no entry defaults to `'explorer'`.
- `setActiveWorktree(null)` does not clobber current global `rightSidebarTab`.

3. `worktrees.test.ts`
- Purge removes `rightSidebarTabByWorktree` entries for deleted worktrees.
- Keep non-deleted worktree entries intact.
- Important harness update: the isolated `createWorktreeSlice` test store must seed `rightSidebarTabByWorktree: {}` (or the purge path will read `undefined`).
- Add refresh-path test: when `fetchWorktrees(repoId)` drops one previously-known worktree (non-empty next list), `purgeWorktreeTerminalState` effect removes that worktree’s `rightSidebarTabByWorktree` entry and preserves surviving entries.
- Add guard test: transient empty refresh (`[]` with existing non-empty cache) does not purge.

## Rollout

1. Extend `EditorSlice` type + initial state.
2. Update `setRightSidebarTab` and `revealInExplorer`.
3. Update `setActiveWorktree` restore path.
4. Update `purgeWorktreeTerminalState` cleanup.
5. Update `fetchWorktrees` purge-on-removal path.
6. Add tests above and run targeted Vitest suites plus `pnpm typecheck`.
