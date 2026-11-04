import { useTranslation } from 'react-i18next'

import Panel from '../../components/admin/Panel'

import { parseCap } from './aiDraft'

const inputClass =
  'af-focus w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm hover:border-violet-300'

/** Default model per provider, default daily cap, RapidAPI cost per call. */
const DefaultsPanel = ({
  draft,
  builtIn,
  providers,
  onModel,
  onDefaults,
  onPricing
}) => {
  const { t } = useTranslation()
  return (
    <Panel subtitle={t('admin.ai.defaultsHint')}>
      <div className="space-y-4">
        {providers.map(p => (
          <div key={p.id}>
            <label
              htmlFor={`ai-default-${p.id}`}
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
            >
              {t('admin.ai.defaultModelFor', { provider: p.label })}
            </label>
            <select
              id={`ai-default-${p.id}`}
              className={`${inputClass} font-mono text-xs`}
              value={
                draft.defaults.models[p.id] ||
                builtIn.defaults.models[p.id] ||
                ''
              }
              onChange={e => onModel(p.id, e.target.value)}
            >
              {[
                ...new Set([
                  draft.defaults.models[p.id],
                  builtIn.defaults.models[p.id],
                  ...p.models.map(m => m.id)
                ])
              ]
                .filter(Boolean)
                .map(id => (
                  <option key={id} value={id}>
                    {id}
                    {id === builtIn.defaults.models[p.id]
                      ? ` (${t('admin.ai.builtIn')})`
                      : ''}
                  </option>
                ))}
            </select>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="ai-default-cap"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
            >
              {t('admin.ai.defaultCap')}
            </label>
            <input
              id="ai-default-cap"
              type="number"
              min="0"
              placeholder={t('admin.ai.unlimited')}
              value={draft.defaults.dailyCapPerUser ?? ''}
              onChange={e =>
                onDefaults({ dailyCapPerUser: parseCap(e.target.value) })
              }
              className={`${inputClass} af-num`}
            />
          </div>
          <div>
            <label
              htmlFor="ai-rapidapi-cost"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
            >
              {t('admin.ai.rapidapiCost')}
            </label>
            <input
              id="ai-rapidapi-cost"
              type="number"
              min="0"
              step="0.0001"
              value={draft.pricing.rapidapiCostPerCallUsd}
              onChange={e =>
                onPricing({
                  rapidapiCostPerCallUsd: Math.max(
                    0,
                    Number(e.target.value) || 0
                  )
                })
              }
              className={`${inputClass} af-num`}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">{t('admin.ai.capHelp')}</p>
      </div>
    </Panel>
  )
}

export default DefaultsPanel
