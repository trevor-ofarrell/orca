import type { GlobalSettings } from '../../../../shared/types'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'

export const AGENT_AWAKE_SETTING_TITLE = 'Keep computer awake during active sessions'
export const AGENT_AWAKE_SETTING_DESCRIPTION =
  'Keeps this computer awake while agents are working or a paired phone is connected. Closing a laptop lid can still force sleep and disconnect this computer from a mobile hotspot.'
const AGENT_AWAKE_SETTING_LABEL_ID = 'agent-awake-setting-label'
const AGENT_AWAKE_SETTING_DESCRIPTION_ID = 'agent-awake-setting-description'

type AgentAwakeSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function AgentAwakeSetting({
  settings,
  updateSettings
}: AgentAwakeSettingProps): React.JSX.Element {
  return (
    <section className="space-y-3">
      <SearchableSetting
        title={AGENT_AWAKE_SETTING_TITLE}
        description={AGENT_AWAKE_SETTING_DESCRIPTION}
        keywords={[
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
        ]}
        className="flex items-start justify-between gap-4 px-1 py-2"
      >
        <div className="min-w-0 shrink space-y-0.5">
          <Label id={AGENT_AWAKE_SETTING_LABEL_ID}>{AGENT_AWAKE_SETTING_TITLE}</Label>
          <p id={AGENT_AWAKE_SETTING_DESCRIPTION_ID} className="text-xs text-muted-foreground">
            {AGENT_AWAKE_SETTING_DESCRIPTION}
          </p>
        </div>
        <button
          role="switch"
          aria-labelledby={AGENT_AWAKE_SETTING_LABEL_ID}
          aria-describedby={AGENT_AWAKE_SETTING_DESCRIPTION_ID}
          aria-checked={settings.keepComputerAwakeWhileAgentsRun}
          onClick={() =>
            updateSettings({
              keepComputerAwakeWhileAgentsRun: !settings.keepComputerAwakeWhileAgentsRun
            })
          }
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors ${
            settings.keepComputerAwakeWhileAgentsRun ? 'bg-foreground' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`pointer-events-none block size-3.5 rounded-full bg-background shadow-sm transition-transform ${
              settings.keepComputerAwakeWhileAgentsRun ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </SearchableSetting>
    </section>
  )
}
