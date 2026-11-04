import { useTranslation } from 'react-i18next'

import { formatBytes, formatPercent } from './format'

const toneFor = ratio =>
  ratio >= 0.9
    ? 'bg-rose-600'
    : ratio >= 0.75
      ? 'bg-amber-500'
      : 'bg-violet-600'

/**
 * Used vs quota. The fill is a full-width bar scaled with transform: scaleX
 * so the change animates on the compositor.
 */
const QuotaBar = ({ used, quota, label }) => {
  const { t, i18n } = useTranslation()
  const ratio = quota ? Math.min(1, Math.max(0, used / quota)) : null
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="af-num text-slate-500">
          {quota
            ? t('admin.db.ofQuota', {
                used: formatBytes(used),
                quota: formatBytes(quota),
                percent: formatPercent(ratio, i18n.language)
              })
            : t('admin.db.noQuota', { used: formatBytes(used) })}
        </span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role={ratio === null ? undefined : 'meter'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ratio === null ? undefined : Math.round(ratio * 100)}
        aria-label={label}
      >
        <div
          className={`af-bar-fill h-full w-full rounded-full ${
            ratio === null ? 'bg-slate-300' : toneFor(ratio)
          }`}
          style={{ transform: `scaleX(${ratio ?? 0})` }}
        />
      </div>
    </div>
  )
}

export default QuotaBar
