import { useRef, useState } from 'react'
import { Loader2, RotateCw } from 'lucide-react'
import type { GlobalSettings } from '../../../../shared/types'
import { useMountedRef } from '../../hooks/useMountedRef'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { getExperimentalSearchEntry } from './experimental-search'
import { translate } from '@/i18n/i18n'

type ExperimentalMultiWindowSettingProps = {
  enabled: boolean
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function ExperimentalMultiWindowSetting({
  enabled,
  updateSettings
}: ExperimentalMultiWindowSettingProps): React.JSX.Element {
  // Why: File > New Window is wired during main-process menu construction.
  // Keep this setting restart-gated so live broadcasts cannot alter policy.
  const enabledAtMountRef = useRef(enabled)
  const restartRequired = enabled !== enabledAtMountRef.current
  const [relaunching, setRelaunching] = useState(false)
  const mountedRef = useMountedRef()

  const handleRelaunch = (): void => {
    if (relaunching) {
      return
    }
    setRelaunching(true)
    void window.api.app.relaunch().catch((error) => {
      console.error('[settings] failed to relaunch for multi-window support:', error)
      if (mountedRef.current) {
        setRelaunching(false)
      }
    })
  }

  return (
    <SearchableSetting
      title={translate('auto.components.settings.ExperimentalPane.efc5cd3ad7', 'Multi-window')}
      description={translate(
        'auto.components.settings.ExperimentalPane.9403a2fffb',
        'Enable File > New Window for multiple monitor workflows. Requires restart.'
      )}
      keywords={getExperimentalSearchEntry().multiWindow.keywords}
      className="space-y-3 py-2"
      id="experimental-multi-window"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 shrink space-y-0.5">
          <Label>
            {translate('auto.components.settings.ExperimentalPane.efc5cd3ad7', 'Multi-window')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.ExperimentalPane.73d191586e',
              'Adds File > New Window for multiple monitor workflows. Requires restart.'
            )}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => updateSettings({ experimentalMultiWindow: !enabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors ${
            enabled ? 'bg-foreground' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow-sm transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {restartRequired ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-medium">
              {translate(
                'auto.components.settings.ExperimentalPane.31d6d8d7b4',
                'Restart required'
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.settings.ExperimentalPane.45513cd4aa',
                'Orca applies multi-window support at startup.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRelaunch}
            disabled={relaunching}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {relaunching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
            {translate('auto.components.settings.ExperimentalPane.c709b5448c', 'Restart')}
          </button>
        </div>
      ) : null}
    </SearchableSetting>
  )
}
