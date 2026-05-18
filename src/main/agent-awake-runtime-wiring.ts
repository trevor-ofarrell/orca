import type { AgentAwakeService } from './agent-awake-service'

export type AgentAwakeRuntimeWiring = {
  onMobileConnectionCountChange: (count: number) => void
}

export function createAgentAwakeRuntimeWiring(
  getService: () => AgentAwakeService | null
): AgentAwakeRuntimeWiring {
  return {
    onMobileConnectionCountChange: (count) => {
      getService()?.setActiveMobileConnectionCount(count)
    }
  }
}
