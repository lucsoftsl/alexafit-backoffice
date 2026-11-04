import { useTranslation } from 'react-i18next'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const RAPIDAPI = 'rapidapi-chatgpt'
const FAMILY_ORDER = [
  'gpt',
  'claude',
  'deepseek',
  'gemini',
  'perplexity',
  'grok',
  'other'
]

/** RapidAPI models: the built-in default first, then the saved list by family. */
const groupByFamily = models => {
  const builtIn = models.filter(m => m.builtIn)
  const rest = models.filter(m => !m.builtIn)
  const families = FAMILY_ORDER.map(family => ({
    family,
    models: rest.filter(m => (m.family || 'other') === family)
  })).filter(g => g.models.length > 0)
  return { builtIn, families }
}

const selectClass =
  'af-focus w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 transition-colors hover:border-violet-300 focus:border-violet-400 disabled:bg-slate-50 disabled:text-slate-400'

/**
 * Provider + model selects. '' means "inherit" (built-in provider / default
 * model); `allowNone` adds an explicit "no fallback" provider option.
 */
const ModelPicker = ({
  idPrefix,
  label,
  providers,
  provider,
  model,
  inheritedProviderLabel,
  inheritedModel,
  allowNone = false,
  imageOnly = false,
  disabled = false,
  onChange
}) => {
  const { t } = useTranslation()
  const resolvedProviderId = provider === 'none' ? null : provider
  const providerForModels =
    providers.find(p => p.id === resolvedProviderId) ||
    providers.find(p => p.label === inheritedProviderLabel)
  const models = providerForModels?.models || []
  const modelListed = !model || models.some(m => m.id === model)
  const isRapidApi = provider !== 'none' && providerForModels?.id === RAPIDAPI
  const grouped = isRapidApi ? groupByFamily(models) : null

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="sr-only" htmlFor={`${idPrefix}-provider`}>
          {t('admin.ai.provider')}
        </label>
        <select
          id={`${idPrefix}-provider`}
          className={selectClass}
          value={provider}
          onChange={e => onChange({ provider: e.target.value, model: '' })}
        >
          <option value="">
            {t('admin.ai.inherit', { value: inheritedProviderLabel })}
          </option>
          {allowNone ? (
            <option value="none">{t('admin.ai.noFallback')}</option>
          ) : null}
          {providers.map(p => (
            <option
              key={p.id}
              value={p.id}
              disabled={!p.configured || (imageOnly && !p.supportsImages)}
            >
              {p.label}
              {!p.configured ? ` (${t('admin.ai.notConfigured')})` : ''}
              {imageOnly && !p.supportsImages
                ? ` (${t('admin.ai.noImages')})`
                : ''}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${idPrefix}-model`}>
          {t('admin.ai.model')}
        </label>
        <select
          id={`${idPrefix}-model`}
          className={`${selectClass} font-mono text-xs`}
          value={model}
          disabled={provider === 'none'}
          onChange={e => onChange({ model: e.target.value })}
        >
          <option value="">
            {t('admin.ai.inherit', { value: inheritedModel || '—' })}
          </option>
          {!modelListed ? <option value={model}>{model}</option> : null}
          {grouped ? (
            <>
              {grouped.builtIn.map(m => (
                <option key={m.id} value={m.id}>
                  {t('admin.ai.rapid.builtInOption', { model: m.id })}
                </option>
              ))}
              {grouped.families.map(g => (
                <optgroup
                  key={g.family}
                  label={t(`admin.ai.rapid.familyName.${g.family}`)}
                >
                  {g.models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label || m.id}
                      {m.reasoning
                        ? ` · ${t(`admin.ai.rapid.level.${m.reasoning}`)}`
                        : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </>
          ) : (
            models.map(m => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))
          )}
        </select>
      </div>
      {isRapidApi && imageOnly ? (
        <p
          role="alert"
          className="mt-1.5 flex items-start gap-1 text-xs font-medium text-amber-700"
        >
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden />
          {t('admin.ai.rapid.imageWarning')}
        </p>
      ) : isRapidApi ? (
        <p className="mt-1.5 text-xs text-slate-500">
          {t('admin.ai.rapid.textOnly')}
          {grouped.families.length === 0
            ? ` ${t('admin.ai.rapid.pickerNoList')}`
            : ''}
        </p>
      ) : null}
    </fieldset>
  )
}

export default ModelPicker
