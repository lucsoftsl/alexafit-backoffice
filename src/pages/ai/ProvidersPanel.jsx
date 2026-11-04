import { useTranslation } from 'react-i18next'
import {
  CheckCircleIcon,
  ClockIcon,
  NoSymbolIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

import Panel from '../../components/admin/Panel'
import { formatMs } from '../../components/admin/format'

/** Which providers have keys, live cooldowns and Gemini models Google withdrew. */
const ProvidersPanel = ({ providers, cooldowns, gone }) => {
  const { t } = useTranslation()
  const goneEntries = Object.entries(gone || {})
  return (
    <Panel subtitle={t('admin.ai.providersHint')}>
      <ul className="space-y-3">
        {providers.map(p => {
          const cooldown = cooldowns.find(c => c.provider === p.id)
          return (
            <li key={p.id} className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{p.label}</span>
                {p.configured ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4" aria-hidden />
                    {t('admin.ai.configured')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                    <XCircleIcon className="h-4 w-4" aria-hidden />
                    {t('admin.ai.notConfigured')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t('admin.ai.modelsAvailable', { count: p.models.length })}
                {p.supportsImages
                  ? ` · ${t('admin.ai.imagesOk')}`
                  : ` · ${t('admin.ai.noImages')}`}
              </p>
              {cooldown ? (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                  <ClockIcon className="h-4 w-4" aria-hidden />
                  {t('admin.ai.cooldown', {
                    group: cooldown.group,
                    remaining: formatMs(cooldown.remainingMs)
                  })}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
      {goneEntries.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {t('admin.ai.goneModels')}
          </p>
          <ul className="space-y-1 text-xs">
            {goneEntries.map(([model, entry]) => (
              <li
                key={model}
                className="flex items-center gap-2 text-slate-600"
              >
                <NoSymbolIcon className="h-4 w-4 text-rose-600" aria-hidden />
                <span className="font-mono">{model}</span>
                <span aria-hidden>→</span>
                <span className="font-mono">
                  {entry.replacement || t('admin.ai.builtInModel')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  )
}

export default ProvidersPanel
