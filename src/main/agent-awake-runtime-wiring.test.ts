import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentAwakeService } from './agent-awake-service'
import { createAgentAwakeRuntimeWiring } from './agent-awake-runtime-wiring'

describe('agent awake runtime wiring', () => {
  it('forwards mobile connection counts to the current awake service', () => {
    const first = { setActiveMobileConnectionCount: vi.fn() } as unknown as AgentAwakeService
    const second = { setActiveMobileConnectionCount: vi.fn() } as unknown as AgentAwakeService
    let current: AgentAwakeService | null = first
    const wiring = createAgentAwakeRuntimeWiring(() => current)

    wiring.onMobileConnectionCountChange(2)
    current = second
    wiring.onMobileConnectionCountChange(0)
    current = null
    wiring.onMobileConnectionCountChange(1)

    expect(first.setActiveMobileConnectionCount).toHaveBeenCalledWith(2)
    expect(second.setActiveMobileConnectionCount).toHaveBeenCalledWith(0)
  })

  it('is included in the production runtime RPC bootstrap options', () => {
    const source = readFileSync(join(import.meta.dirname, 'index.ts'), 'utf-8')

    expect(source).toContain('...createAgentAwakeRuntimeWiring(() => agentAwakeService)')
  })
})
