import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/types'
import { useAppStore } from '../../store'
import {
  AGENT_AWAKE_SETTING_DESCRIPTION,
  AGENT_AWAKE_SETTING_TITLE,
  AgentAwakeSetting
} from './AgentAwakeSetting'
import { AgentsPane, AGENTS_PANE_SEARCH_ENTRIES } from './AgentsPane'
import { matchesSettingsSearch } from './settings-search'

type ReactElementLike = {
  type: unknown
  props: Record<string, unknown>
}

function renderPane(settings: GlobalSettings): string {
  return renderToStaticMarkup(
    React.createElement(AgentsPane, {
      settings,
      updateSettings: vi.fn()
    })
  )
}

function visit(node: unknown, cb: (node: ReactElementLike) => void): void {
  if (node == null || typeof node === 'string' || typeof node === 'number') {
    return
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => visit(entry, cb))
    return
  }
  const element = node as ReactElementLike
  cb(element)
  if (element.props?.children) {
    visit(element.props.children, cb)
  }
}

function findSwitch(node: unknown): ReactElementLike {
  let found: ReactElementLike | null = null
  visit(node, (entry) => {
    if (entry.props.role === 'switch') {
      found = entry
    }
  })
  if (!found) {
    throw new Error('switch not found')
  }
  return found
}

describe('AgentsPane', () => {
  beforeEach(() => {
    useAppStore.setState({
      settingsSearchQuery: '',
      detectedAgentIds: ['claude'],
      isDetectingAgents: false,
      isRefreshingAgents: false
    })
  })

  it('renders the keep-awake toggle from settings', () => {
    const markup = renderPane(getDefaultSettings('/tmp'))

    expect(markup).toContain(AGENT_AWAKE_SETTING_TITLE)
    expect(markup).toContain(AGENT_AWAKE_SETTING_DESCRIPTION)
    expect(markup).toContain('aria-checked="false"')
  })

  it('toggles the keep-awake setting with the next value', () => {
    const updateSettings = vi.fn()
    const element = AgentAwakeSetting({
      settings: {
        ...getDefaultSettings('/tmp'),
        keepComputerAwakeWhileAgentsRun: false
      },
      updateSettings
    })

    const keepAwakeSwitch = findSwitch(element)
    expect(keepAwakeSwitch.props['aria-labelledby']).toBe('agent-awake-setting-label')
    expect(keepAwakeSwitch.props['aria-describedby']).toBe('agent-awake-setting-description')
    expect(keepAwakeSwitch.props['aria-checked']).toBe(false)

    const onClick = keepAwakeSwitch.props.onClick as () => void
    onClick()

    expect(updateSettings).toHaveBeenCalledWith({
      keepComputerAwakeWhileAgentsRun: true
    })
  })

  it('includes awake and sleep search metadata for the setting', () => {
    expect(matchesSettingsSearch('awake', AGENTS_PANE_SEARCH_ENTRIES)).toBe(true)
    expect(matchesSettingsSearch('sleep', AGENTS_PANE_SEARCH_ENTRIES)).toBe(true)
    expect(matchesSettingsSearch('mobile', AGENTS_PANE_SEARCH_ENTRIES)).toBe(true)
    expect(matchesSettingsSearch('hotspot', AGENTS_PANE_SEARCH_ENTRIES)).toBe(true)
    expect(matchesSettingsSearch('lid', AGENTS_PANE_SEARCH_ENTRIES)).toBe(true)
  })
})
