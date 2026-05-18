import type { SettingsSearchEntry } from './settings-search'
import { AGENT_AWAKE_SETTING_DESCRIPTION, AGENT_AWAKE_SETTING_TITLE } from './AgentAwakeSetting'

export const AGENTS_PANE_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  {
    title: 'Agents',
    description: 'Configure AI coding agents, default agent, and command overrides.',
    keywords: [
      'agent',
      'default',
      'claude',
      'codex',
      'opencode',
      'pi',
      'gemini',
      'aider',
      'goose',
      'amp',
      'kilocode',
      'kiro',
      'charm',
      'auggie',
      'cline',
      'codebuff',
      'continue',
      'cursor',
      'droid',
      'kimi',
      'mistral',
      'qwen',
      'rovo',
      'hermes',
      'openclaw',
      'copilot',
      'grok',
      'github',
      'github copilot',
      'command',
      'override',
      'install',
      'detected'
    ]
  },
  {
    title: AGENT_AWAKE_SETTING_TITLE,
    description: AGENT_AWAKE_SETTING_DESCRIPTION,
    keywords: [
      'awake',
      'sleep',
      'power',
      'agent',
      'running',
      'working',
      'mobile',
      'phone',
      'hotspot',
      'lid'
    ]
  }
]
