import { useTranslation } from 'react-i18next'
import {
  ArrowRightIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

import { formatMs } from '../../components/admin/format'

import ModelPicker from './ModelPicker'
import { parseCap } from './aiDraft'

const Toggle = ({ id, checked, onChange, label }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`af-focus relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
      checked ? 'bg-violet-600' : 'bg-slate-300'
    }`}
  >
    <span
      className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
      style={{ transform: `translateX(${checked ? 22 : 2}px)` }}
    />
  </button>
)

const TestResult = ({ result }) => {
  const { t } = useTranslation()
  if (!result) return null
  if (result.pending) {
    return (
      <span className="text-xs text-slate-500">{t('admin.ai.testing')}</span>
    )
  }
  return result.ok ? (
    <span className="af-enter inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <CheckCircleIcon className="h-4 w-4" aria-hidden />
      {t('admin.ai.testOk', { latency: formatMs(result.latencyMs) })}
    </span>
  ) : (
    <span
      className="af-enter inline-flex items-center gap-1 text-xs font-medium text-rose-700"
      title={result.message || ''}
    >
      <ExclamationTriangleIcon className="h-4 w-4" aria-hidden />
      {t('admin.ai.testFailed', { code: result.errorCode || 'ERROR' })}
    </span>
  )
}

/** One AI feature: enabled, primary → fallback, daily cap, test. */
const FeatureRow = ({
  feature,
  value,
  providers,
  providerLabel,
  effective,
  color,
  usage,
  testResult,
  onChange,
  onTest
}) => {
  const { t } = useTranslation()
  const id = `ai-${feature.id}`
  const builtInFallbackLabel = feature.builtIn.fallbackProvider
    ? providerLabel(feature.builtIn.fallbackProvider)
    : t('admin.ai.none')

  return (
    <li
      className={`af-lift rounded-3xl border bg-white p-5 ${
        value.enabled
          ? 'border-slate-200'
          : 'border-dashed border-slate-300 bg-slate-50/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{feature.label}</h3>
            <p className="truncate font-mono text-[11px] text-slate-400">
              {feature.where}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {usage ? (
            <span className="af-num text-xs text-slate-500">
              {t('admin.ai.featureUsage', {
                calls: usage.calls,
                p95: formatMs(usage.latency?.p95)
              })}
            </span>
          ) : null}
          <label
            htmlFor={`${id}-enabled`}
            className="text-xs font-medium text-slate-600"
          >
            {value.enabled ? t('admin.ai.enabled') : t('admin.ai.disabled')}
          </label>
          <Toggle
            id={`${id}-enabled`}
            checked={value.enabled}
            label={t('admin.ai.enabledFor', { feature: feature.label })}
            onChange={enabled => onChange({ enabled })}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 items-end gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_9rem]">
        <ModelPicker
          idPrefix={`${id}-primary`}
          label={t('admin.ai.primary')}
          providers={providers}
          provider={value.provider}
          model={value.model}
          inheritedProviderLabel={providerLabel(feature.builtIn.provider)}
          inheritedModel={effective.primary.model}
          imageOnly={feature.needsImage}
          disabled={!value.enabled}
          onChange={patch => onChange(patch)}
        />
        <ArrowRightIcon
          className="mb-2.5 hidden h-4 w-4 text-slate-300 lg:block"
          aria-hidden
        />
        <ModelPicker
          idPrefix={`${id}-fallback`}
          label={t('admin.ai.fallback')}
          providers={providers}
          provider={value.fallbackProvider}
          model={value.fallbackModel}
          inheritedProviderLabel={builtInFallbackLabel}
          inheritedModel={effective.fallback?.model}
          allowNone
          imageOnly={feature.needsImage}
          disabled={!value.enabled}
          onChange={patch =>
            onChange({
              ...(patch.provider !== undefined
                ? { fallbackProvider: patch.provider }
                : {}),
              fallbackModel: patch.model ?? value.fallbackModel
            })
          }
        />
        <div>
          <label
            htmlFor={`${id}-cap`}
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
          >
            {t('admin.ai.dailyCap')}
          </label>
          <input
            id={`${id}-cap`}
            type="number"
            min="0"
            inputMode="numeric"
            placeholder={t('admin.ai.capInherit')}
            value={value.dailyCapPerUser ?? ''}
            disabled={!value.enabled}
            onChange={e =>
              onChange({ dailyCapPerUser: parseCap(e.target.value) })
            }
            className="af-focus af-num w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm hover:border-violet-300"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">
          {t('admin.ai.runsOn')}{' '}
          <span className="font-mono text-slate-700">
            {providerLabel(effective.primary.provider)} ·{' '}
            {effective.primary.model}
          </span>
          {effective.fallback ? (
            <>
              {' '}
              {t('admin.ai.thenFallback')}{' '}
              <span className="font-mono text-slate-700">
                {providerLabel(effective.fallback.provider)} ·{' '}
                {effective.fallback.model}
              </span>
            </>
          ) : null}
        </p>
        <div className="flex items-center gap-3">
          <TestResult result={testResult} />
          <button
            type="button"
            onClick={() => onTest(effective.primary)}
            disabled={testResult?.pending}
            className="af-press af-focus inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700 disabled:opacity-60"
          >
            <BeakerIcon className="h-4 w-4" aria-hidden />
            {t('admin.ai.test')}
          </button>
        </div>
      </div>
    </li>
  )
}

export default FeatureRow
