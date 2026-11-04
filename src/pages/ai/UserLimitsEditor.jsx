import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Skeleton from '../../components/admin/Skeleton'
import useAdminResource from '../../components/admin/useAdminResource'
import { getAiUserLimits, saveAiUserLimits } from '../../services/adminApi'

const MODES = ['inherit', 'custom', 'blocked']
const PERIODS = ['day', 'week']

const inputClass =
  'af-focus rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm hover:border-violet-300 disabled:opacity-50'

const isExpired = row =>
  Boolean(row?.expiresAt) && new Date(row.expiresAt).getTime() <= Date.now()

/** Editor rows (manual overrides only) from the server rows. */
export const draftFromRows = (rows, groupIds) =>
  Object.fromEntries(
    groupIds.map(id => {
      const manual = rows.find(
        r => r.featureGroup === id && r.source === 'manual'
      )
      if (!manual) {
        return [id, { mode: 'inherit', limit: '', period: 'day', reason: '' }]
      }
      return [
        id,
        {
          mode: manual.blocked
            ? 'blocked'
            : manual.limit === null
              ? 'inherit'
              : 'custom',
          limit: manual.limit === null ? '' : String(manual.limit),
          period: manual.period || 'day',
          reason: manual.reason || ''
        }
      ]
    })
  )

export const payloadFromDraft = draft => ({
  overrides: Object.entries(draft).map(([featureGroup, v]) =>
    v.mode === 'custom'
      ? {
          featureGroup,
          mode: 'custom',
          limit: Number(v.limit),
          period: v.period,
          reason: v.reason || null
        }
      : v.mode === 'blocked'
        ? { featureGroup, mode: 'blocked', reason: v.reason }
        : { featureGroup, mode: 'inherit' }
  )
})

const invalidRow = v =>
  (v.mode === 'custom' &&
    (!/^\d+$/.test(String(v.limit)) || Number(v.limit) > 100000)) ||
  (v.mode === 'blocked' && !v.reason.trim())

/** "3 / day", "fair use 50 / day", "no limit" for a plan default. */
const PlanDefault = ({ def, plan }) => {
  const { t } = useTranslation()
  if (!def) return null
  const own = def[plan] || def.free
  const fairUse = plan === 'premium' || own.limit === null
  const shown = own.limit === null ? def.premium : own
  const text =
    shown?.limit === null || shown?.limit === undefined
      ? t('admin.ai.limits.noLimit')
      : t('admin.ai.limits.perPeriod', {
          limit: shown.limit,
          period: t(`admin.ai.limits.period.${shown.period}`)
        })
  return (
    <span className="text-xs text-slate-500">
      {t('admin.ai.limits.planDefault')}:{' '}
      <span className="af-num font-medium text-slate-700">
        {fairUse ? `${t('admin.ai.limits.fairUse')} · ` : ''}
        {text}
      </span>
      {def.burstPerMinute !== null && def.burstPerMinute !== undefined ? (
        <span className="af-num">
          {' '}
          · {t('admin.ai.limits.burst', { n: def.burstPerMinute })}
        </span>
      ) : null}
    </span>
  )
}

const AutoRow = ({ row, busy, onClear, onConvert }) => {
  const { t, i18n } = useTranslation()
  const expired = isExpired(row)
  const what = row.blocked
    ? t('admin.ai.limits.autoBlocked')
    : t('admin.ai.limits.perPeriod', {
        limit: row.limit,
        period: t(`admin.ai.limits.period.${row.period || 'day'}`)
      })
  return (
    <div
      className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
        expired
          ? 'border-slate-200 bg-slate-50 text-slate-400'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <p>
        <span className="mr-1.5 rounded-full bg-white/70 px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em]">
          {t('admin.ai.limits.source.auto')}
        </span>
        <span className="af-num font-medium">{what}</span>
        {row.expiresAt ? (
          <span>
            {' '}
            ·{' '}
            {t(
              expired ? 'admin.ai.limits.expired' : 'admin.ai.limits.expires',
              {
                date: new Date(row.expiresAt).toLocaleString(i18n.language)
              }
            )}
          </span>
        ) : null}
        {row.reason ? <span> · {row.reason}</span> : null}
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={onConvert}
          className="af-focus af-press rounded-full border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:border-violet-400 disabled:opacity-50"
        >
          {t('admin.ai.limits.makeManual')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClear}
          className="af-focus af-press rounded-full px-2.5 py-1 font-semibold hover:text-rose-700 disabled:opacity-50"
        >
          {t('admin.ai.limits.clearAuto')}
        </button>
      </div>
    </div>
  )
}

/**
 * Per-group overrides for one user: inherit the plan default, a custom limit
 * + period, or blocked with a reason. Automatic (abuse) limits show their
 * expiry and can be cleared or turned into a manual limit.
 */
const UserLimitsEditor = ({ userId, plan = 'free', onSaved }) => {
  const { t } = useTranslation()
  const resource = useAdminResource(() => getAiUserLimits(userId))
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const data = resource.data
  const groupIds = useMemo(
    () =>
      data
        ? [data.allGroup, ...data.groups.filter(g => g.ai).map(g => g.id)]
        : [],
    [data]
  )
  const rows = useMemo(() => data?.rows || [], [data])

  useEffect(() => {
    if (data) setDraft(draftFromRows(rows, groupIds))
  }, [data, rows, groupIds])

  const apply = async body => {
    setSaving(true)
    setMessage(null)
    try {
      await saveAiUserLimits(userId, body)
      await resource.reload()
      setMessage({ tone: 'ok', text: t('admin.ai.limits.saved') })
      onSaved?.()
    } catch (error) {
      setMessage({
        tone: 'bad',
        text:
          error.code === 'USER_LIMITS_TABLE_MISSING'
            ? t('admin.ai.limits.tableMissing')
            : t('admin.ai.limits.saveFailed', {
                details: (error.details || [error.message]).join('; ')
              })
      })
    } finally {
      setSaving(false)
    }
  }

  if (resource.loading || !draft) {
    return <Skeleton className="h-64 w-full rounded-2xl" />
  }
  if (resource.error) {
    return (
      <p role="alert" className="text-sm text-rose-700">
        {t('admin.ai.limits.loadFailed')}
      </p>
    )
  }

  const invalid = Object.values(draft).some(invalidRow)
  const patch = (id, change) =>
    setDraft(d => ({ ...d, [id]: { ...d[id], ...change } }))
  const groupLabel = id =>
    id === data.allGroup
      ? t('admin.ai.limits.groups.all')
      : t(`admin.ai.limits.groups.${id}`)

  return (
    <div className="space-y-3">
      {data.tableMissing ? (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          {t('admin.ai.limits.tableMissing')}
        </p>
      ) : null}
      <ul className="space-y-3">
        {groupIds.map(id => {
          const v = draft[id]
          const auto = rows.find(
            r => r.featureGroup === id && r.source === 'auto'
          )
          const fieldId = `limit-${id === '*' ? 'all' : id}`
          return (
            <li
              key={id}
              className="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {groupLabel(id)}
                </p>
                {id === data.allGroup ? (
                  <span className="text-xs text-slate-500">
                    {t('admin.ai.limits.allHint')}
                  </span>
                ) : (
                  <PlanDefault def={data.tierLimits.groups[id]} plan={plan} />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div
                  role="radiogroup"
                  aria-label={groupLabel(id)}
                  className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5"
                >
                  {MODES.map(mode => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={v.mode === mode}
                      onClick={() => patch(id, { mode })}
                      className={`af-focus af-press rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-[160ms] motion-reduce:transition-none ${
                        v.mode === mode
                          ? mode === 'blocked'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t(`admin.ai.limits.mode.${mode}`)}
                    </button>
                  ))}
                </div>
                {v.mode === 'custom' ? (
                  <>
                    <label htmlFor={`${fieldId}-n`} className="sr-only">
                      {t('admin.ai.limits.limit')}
                    </label>
                    <input
                      id={`${fieldId}-n`}
                      type="number"
                      min={0}
                      max={100000}
                      inputMode="numeric"
                      value={v.limit}
                      onChange={e => patch(id, { limit: e.target.value })}
                      aria-invalid={invalidRow(v)}
                      className={`${inputClass} af-num w-24 ${invalidRow(v) ? 'border-rose-300' : ''}`}
                    />
                    <label htmlFor={`${fieldId}-p`} className="sr-only">
                      {t('admin.ai.limits.periodLabel')}
                    </label>
                    <select
                      id={`${fieldId}-p`}
                      value={v.period}
                      onChange={e => patch(id, { period: e.target.value })}
                      className={inputClass}
                    >
                      {PERIODS.map(p => (
                        <option key={p} value={p}>
                          {t(`admin.ai.limits.per.${p}`)}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                {v.mode !== 'inherit' ? (
                  <>
                    <label htmlFor={`${fieldId}-r`} className="sr-only">
                      {t('admin.ai.limits.reason')}
                    </label>
                    <input
                      id={`${fieldId}-r`}
                      type="text"
                      maxLength={500}
                      value={v.reason}
                      onChange={e => patch(id, { reason: e.target.value })}
                      placeholder={
                        v.mode === 'blocked'
                          ? t('admin.ai.limits.reasonRequired')
                          : t('admin.ai.limits.reasonOptional')
                      }
                      className={`${inputClass} min-w-[12rem] flex-1`}
                    />
                  </>
                ) : null}
              </div>
              {auto ? (
                <AutoRow
                  row={auto}
                  busy={saving}
                  onClear={() => apply({ overrides: [], clearAuto: [id] })}
                  onConvert={() => apply({ overrides: [], convertAuto: [id] })}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (window.confirm(t('admin.ai.limits.resetConfirm'))) {
              apply({ reset: true })
            }
          }}
          className="af-focus af-press rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-rose-700 disabled:opacity-50"
        >
          {t('admin.ai.limits.reset')}
        </button>
        <div className="flex items-center gap-3">
          {message ? (
            <p
              role={message.tone === 'bad' ? 'alert' : 'status'}
              className={`text-xs ${message.tone === 'bad' ? 'text-rose-700' : 'text-emerald-700'}`}
            >
              {message.text}
            </p>
          ) : null}
          <button
            type="button"
            disabled={saving || invalid}
            onClick={() => apply(payloadFromDraft(draft))}
            className="af-focus af-press rounded-full bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? t('admin.ai.saving') : t('admin.ai.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserLimitsEditor
