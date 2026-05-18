# Keep Awake for Mobile Hotspot Sessions

## Problem or Goal

The existing "Keep computer awake while agents are working" setting only considers agent
status. When a paired phone is connected to Orca over a mobile hotspot, closing or idling
the laptop can drop the hotspot/Wi-Fi path and make the mobile companion unusable even
though the user enabled the awake feature.

Goal: when the user enables the keep-awake feature, Orca should also keep the desktop
awake while an authenticated Orca Mobile client is actively connected. The implementation
must be clear about the OS limit: Electron/macOS power assertions can prevent idle sleep,
but cannot reliably force a laptop to keep networking alive after the physical lid is
closed.

## Current Behavior

- `src/main/agent-awake-service.ts:12` accepts only Electron
  `powerSaveBlocker.start('prevent-app-suspension')`.
- `src/main/agent-awake-service.ts:41` stores a single enabled bit, and
  `src/main/agent-awake-service.ts:49` stores only agent status snapshots.
- `src/main/agent-awake-service.ts:61` starts the blocker only when the setting is enabled
  and at least one fresh, current-runtime agent status is `working`.
- `src/main/index.ts:731` creates the awake service, `src/main/index.ts:733` initializes
  it from `keepComputerAwakeWhileAgentsRun`, and `src/main/index.ts:738` wires only
  `agentHookServer.subscribeStatusChanges(...)` into it.
- `src/main/ipc/settings.ts:43` updates the service only when
  `keepComputerAwakeWhileAgentsRun` changes.
- `src/renderer/src/components/settings/AgentAwakeSetting.tsx:17` and
  `src/renderer/src/components/settings/AgentAwakeSetting.tsx:25` describe an
  agent-only behavior and state that the display can still turn off.
- Mobile clients connect through the runtime WebSocket path:
  `src/main/runtime/runtime-rpc.ts:414` starts the WebSocket transport,
  `src/main/runtime/runtime-rpc.ts:443` handles E2EE readiness,
  `src/main/runtime/runtime-rpc.ts:449` validates the device token and updates
  `lastSeenAt`, and `src/main/runtime/runtime-rpc.ts:484` handles connection close.
- `src/main/runtime/rpc/ws-transport.ts:105` already reports close events with
  `hasOtherConnections`, so the runtime can distinguish one socket closing from the last
  socket for a paired device.
- Mobile has reconnection tolerance for laptop wake/network blips:
  `mobile/src/transport/rpc-client.ts:66` uses a tiered reconnect backoff and
  `mobile/src/transport/connection-health.ts:3` classifies longer outages as unreachable.

Reference behavior:

- Electron documents `prevent-app-suspension` as keeping the app/system active while
  allowing the screen to turn off, and `prevent-display-sleep` as a stronger mode that
  keeps the display active too:
  https://www.electronjs.org/docs/latest/api/power-save-blocker
- Apple documents IOPM assertions as best-effort power assertions:
  https://developer.apple.com/documentation/iokit/iopmlib_h/iopmassertiontypes

## Proposed Design

Keep the existing persisted setting for compatibility, but expand its behavior and copy
from agent-only to "active Orca work":

Direction decision:

- Use the existing keep-awake setting as the single user control. A second mobile-only
  toggle would add settings complexity while controlling the same local power assertion.
- Do not attempt an OS-specific lid-close or hotspot override. Electron power blockers
  are idle-sleep assertions, not a reliable way to keep a closed laptop associated with a
  phone hotspot.
- Do not introduce a relay or overlay-network fallback in this change. That may be a
  better long-term answer for closed-lid/mobile-hotspot reliability, but it is larger than
  this power-management fix.

1. Extend the awake service with a second input for authenticated mobile connectivity.
   - Add `setActiveMobileConnectionCount(count: number)` to `AgentAwakeService`.
   - Do not rename the class in this PR. The setting key, IPC wiring, tests, and
     renderer component names are currently agent-oriented; a rename is mechanical churn
     and can be handled separately if the broader feature name sticks.
   - Keep the persisted setting key `keepComputerAwakeWhileAgentsRun` for this change to
     avoid a migration.
   - Normalize incoming counts with `Number.isFinite`, `Math.trunc`, and
     `Math.max(0, value)` before storing them. A bad callback must not strand a wake
     blocker.
   - Compute `shouldBlock` from the enabled setting plus either a fresh working agent
     status or at least one active mobile connection.
   - Keep one blocker ID regardless of how many wake reasons are present. Stop it only
     after every reason is gone or the setting is disabled.
   - Continue using `prevent-app-suspension` as the default blocker. It is the right
     tradeoff for long-running agent/mobile sessions because it keeps the system active
     without forcing the display to stay on. Do not switch to `prevent-display-sleep`
     without a separate explicit product decision because that burns battery and still
     does not reliably solve physical lid closure.

2. Report authenticated mobile-scoped WebSocket connection count from the runtime RPC server.
   - Add an optional constructor callback to `OrcaRuntimeRpcServer`, for example
     `onMobileConnectionCountChange?: (count: number) => void`.
   - Track only WebSockets whose E2EE channel validates to a `DeviceEntry` with
     `scope === 'mobile'`. Do not count runtime-scoped web/CLI tokens.
   - Add `private activeMobileWebSockets = new Set<WebSocket>()` and emit
     `activeMobileWebSockets.size`.
   - Add small private helpers such as `trackAuthenticatedMobileSocket(ws, device)` and
     `untrackMobileSocket(ws)`. They should emit only when `Set` membership changes, so
     duplicate auth/request paths do not produce noisy refreshes.
   - Add the socket to the set in the E2EE `onReady` path after
     `deviceRegistry.validateToken(...)` returns the `DeviceEntry`. Do not use
     `handleWebSocketMessage(...)` as the primary tracking point because the wake reason
     is authenticated connection presence, not receipt of an RPC frame.
   - Continue calling `wsTransport.setClientId(ws, ch.deviceToken)` for every validated
     channel so close cleanup and the pre-auth timer keep their current behavior.
   - Remove that socket from the set in `wsTransport.onConnectionClose(...)` before
     deleting the E2EE channel and connection id. Emit the new count whenever membership
     changes.
   - In `stop()`, clear the set and emit `0` before awaiting transport shutdown. Close
     handlers may still run afterward, but the untrack helper must be idempotent and must
     not re-emit zero repeatedly.
   - Wire the callback in `src/main/index.ts` to
     `agentAwakeService.setActiveMobileConnectionCount(count)`.

3. Update settings UX without adding a new toggle.
   - Update the setting title/description/search metadata to mention agents and mobile,
     e.g. "Keep computer awake during active sessions" and "Keeps this computer awake
     while agents are working or a paired phone is connected."
   - Add a short limitation sentence in the setting description or Mobile pane:
     "Closing a laptop lid can still force sleep and disconnect this computer from a mobile
     hotspot."
   - Preserve the switch role, existing setting storage, and styleguide token usage.

4. Keep SSH behavior unchanged.
   - The awake blocker applies to the local desktop that is hosting the UI/runtime, even
     when the active worktree or terminal is backed by SSH.
   - Do not infer remote activity from SSH connection state; only agent hook status and
     authenticated mobile client presence should create local awake reasons.

## Architecture and Data Flow

System context:

```text
[Renderer settings switch]
          |
          v
[settings IPC + Store] ---- enabled ----+
                                        |
[Agent hook server] ---- statuses ------+
                                        v
                            [AgentAwakeService]
                                        |
                                        v
                          [Electron powerSaveBlocker]

[Mobile WebSocket + E2EE]
          |
          v
[OrcaRuntimeRpcServer activeMobileWebSockets]
          |
          +---- count callback ---------+
```

Data-flow cases:

- Happy path: the user enables the setting, a mobile-scoped WebSocket completes E2EE
  authentication, `OrcaRuntimeRpcServer` validates the token to a mobile `DeviceEntry`,
  the socket is added to `activeMobileWebSockets`, the count callback emits `1`, and
  `AgentAwakeService` starts one `prevent-app-suspension` blocker. On socket close, the
  runtime removes that exact socket and emits the new count.
- Nil/missing data: if WebSocket support is disabled, the device registry is unavailable,
  or no callback is passed in tests, the runtime emits no mobile wake reason and existing
  agent-only behavior remains unchanged.
- Empty collection: when `activeMobileWebSockets.size === 0`, mobile contributes no wake
  reason. The blocker remains active only if a fresh current-runtime agent status is still
  `working`.
- Upstream error: failed E2EE auth, token revocation, WebSocket error, transport stop, or
  app quit must all converge through idempotent cleanup that removes the socket from the
  active set and emits `0` when the last mobile socket is gone.

User-facing states:

- Setting off: no local power blocker is held for agents or mobile.
- Setting on, no active agents/mobile: the setting is enabled but no blocker is held.
- Setting on, active agent or mobile connection: one local blocker is held; no new status
  badge is needed because the setting controls policy, not a live connection monitor.
- Laptop lid closed: the UI copy must not imply a guarantee. The limitation sentence is
  the user-facing recovery path for hotspot/clamshell behavior.

## Edge Cases

- Multiple sockets from one phone: count sockets, or use a `Set<WebSocket>`, so host screen
  plus accounts/terminal streams keep the blocker until the last socket closes.
- Duplicate E2EE/auth paths for the same socket: `Set<WebSocket>` tracking must be
  idempotent and must emit only when the effective count changes.
- Multiple phones: keep blocking until all authenticated mobile-scoped sockets close.
- Runtime-scoped browser/CLI clients: do not count them; the feature is for Orca Mobile.
- Pre-auth or failed-auth WebSockets: do not count them.
- Device revocation: `terminateClientConnections(...)` should trigger close cleanup and
  decrement the mobile awake count.
- WebSocket server stop or app quit: force the count to zero.
- Agent statuses go stale while mobile remains connected: blocker stays active because
  mobile is a separate reason.
- Mobile disconnects while an agent is still working: blocker stays active because agent
  status is still eligible.
- Setting disabled while mobile is connected: blocker stops immediately.
- Physical lid close: document as not reliably preventable by Orca. Users should leave
  the laptop open, use OS/clamshell-supported hardware setup, or use an overlay network
  path that does not depend on the laptop keeping a hotspot association alive.

## Test Plan

Unit tests:

- Extend `src/main/agent-awake-service.test.ts`:
  - starts the blocker when enabled with `activeMobileConnectionCount > 0` and no working
    agents.
  - does not start when disabled with a mobile connection.
  - keeps one blocker when both mobile and agent reasons are present.
  - stops only after both the last mobile connection drops and no eligible agent statuses
    remain.
  - ignores negative, fractional, and `NaN` mobile counts by normalizing to a
    non-negative integer.

- Extend `src/main/runtime/runtime-rpc.test.ts` or add a focused runtime RPC test:
  - authenticated mobile-scoped E2EE WebSocket increments the mobile count using the
    existing `authenticateMobileWs(...)` mocked-phone helper.
  - closing one of two sockets for the same mobile token emits `1`, not `0`.
  - closing the last mobile socket emits `0`.
  - duplicate auth/RPC activity on the same socket does not emit a duplicate increment.
  - runtime-scoped tokens and failed-auth sockets do not affect the count.
  - revocation/transport stop clears the count exactly once from the caller's perspective.

Renderer tests:

- Update `src/renderer/src/components/settings/AgentsPane.test.tsx` for the new title,
  description, and search terms (`mobile`, `hotspot`, `lid`).

Playwright / mocked phone coverage:

- Keep `tests/e2e/settings-agent-awake.spec.ts` focused on persistence, updating locators
  to the new accessible name.
- Add mocked-phone coverage at the main/runtime layer rather than requiring a physical
  device. The repo already has `authenticateMobileWs(...)` in
  `src/main/runtime/runtime-rpc.test.ts`, which exercises the real WebSocket + E2EE
  handshake against a local server.
- Manual mocked-phone validation after implementation:
  1. Start Orca dev/Electron with mobile enabled.
  2. Pair the local mocked/mobile WebSocket client.
  3. Enable the keep-awake setting.
  4. Confirm the desktop starts one Electron power save blocker while the mocked phone is
     connected and stops after disconnect.
  5. Confirm the settings copy warns that closing the lid can still disconnect hotspot
     sessions.

Not covered in automation:

- Actual laptop lid-close behavior and carrier/mobile-hotspot behavior. That depends on
  hardware, OS power policy, and hotspot implementation, so it should be documented and
  manually spot-checked only.

## Rollout Order

1. Add mobile connection-count tracking and tests in `OrcaRuntimeRpcServer`.
2. Extend the awake service reason model and tests.
3. Wire runtime mobile count into the service in `src/main/index.ts`.
4. Update settings copy/search tests and the E2E locator.
5. Run targeted tests, then `pnpm typecheck` and `pnpm lint`.
6. Validate with a mocked mobile WebSocket/client path if available; otherwise document
   that validation used runtime-level mocked mobile connections.

## ref-oss

`ref-oss` was not used. This change is mostly Electron/macOS power-management behavior
and Orca's own mobile WebSocket lifecycle; official Electron and Apple documentation are
more directly relevant than editor or terminal OSS patterns.
