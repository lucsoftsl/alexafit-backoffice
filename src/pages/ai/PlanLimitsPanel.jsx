import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Panel from '../../components/admin/Panel'
import Skeleton from '../../components/admin/Skeleton'
import useAdminResource from '../../components/admin/useAdminResource'
import { getTierLimits, saveTierLimits } from '../../services/adminApi'

const PERIODS = ['day', 'week']
const FASTING_PLANS = ['12:12', '14:10', '16:8', '18:6', '20:4', 'omad']
const CAP_FIELDS = ['favourites', 'ownRecipes', 'progressHistoryWeeks']
// Coaching/support chat allowance for non-coaching clients (server-enforced).
const CHAT_CAP_FIELDS = [
  'introChatMessages',
  'introChatDays',
  'freeChatMessagesPerDay'
]
const NUMERIC_CAP_FIELDS = [...CAP_FIELDS, ...CHAT_CAP_FIELDS]
const MAX = 100000
const FIELD_MAX = { introChatDays: 365 }

const inputClass =
  'af-focus rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm hover:border-violet-300'

/** '' ↔ null (no limit); other text is kept so the admin can fix it. */
const toText = value =>
  value === null || value === undefined ? '' : String(value)
const toValue = text => (text === '' ? null : Number(text))
const badNumber = (text, max = MAX) =>
  text !== '' && (!/^\d+$/.test(text) || Number(text) > max)
const badCap = (draft, f) => badNumber(draft.caps.free[f], FIELD_MAX[f])

const draftFrom = tierLimits => ({
  groups: Object.fromEntries(
    Object.entries(tierLimits.groups).map(([id, g]) => [
      id,
      {
        free: { limit: toText(g.free.limit), period: g.free.period },
        premium: { limit: toText(g.premium.limit), period: g.premium.period },
        burstPerMinute: toText(g.burstPerMinute)
      }
    ])
  ),
  caps: {
    free: {
      ...tierLimits.caps.free,
      ...Object.fromEntries(
        NUMERIC_CAP_FIELDS.map(f => [f, toText(tierLimits.caps.free[f])])
      )
    },
    premium: tierLimits.caps.premium
  }
})

const payloadFrom = draft => ({
  groups: Object.fromEntries(
    Object.entries(draft.groups).map(([id, g]) => [
      id,
      {
        free: { limit: toValue(g.free.limit), period: g.free.period },
        premium: { limit: toValue(g.premium.limit), period: g.premium.period },
        burstPerMinute: toValue(g.burstPerMinute)
      }
    ])
  ),
  caps: {
    free: {
      ...draft.caps.free,
      ...Object.fromEntries(
        NUMERIC_CAP_FIELDS.map(f => [f, toValue(draft.caps.free[f])])
      )
    },
    premium: draft.caps.premium
  }
})

const hasErrors = draft =>
  Object.values(draft.groups).some(
    g =>
      badNumber(g.free.limit) ||
      badNumber(g.premium.limit) ||
      badNumber(g.burstPerMinute)
  ) || NUMERIC_CAP_FIELDS.some(f => badCap(draft, f))

const LimitInput = ({ id, label, value, onChange, placeholder }) => (
  <>
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    <input
      id={id}
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value.trim())}
      aria-invalid={badNumber(value)}
      className={`${inputClass} af-num w-20 ${badNumber(value) ? 'border-rose-300' : ''}`}
    />
  </>
)

const PeriodSelect = ({ id, label, value, onChange }) => {
  const { t } = useTranslation()
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      >
        {PERIODS.map(p => (
          <option key={p} value={p}>
            {t(`admin.ai.limits.per.${p}`)}
          </option>
        ))}
      </select>
    </>
  )
}

/**
 * Admin › AI › Plan limits: the free caps, the premium fair-use ceilings
 * (hidden from users) and the per-minute burst limit, per feature group,
 * plus the free plan's non-AI caps the app enforces.
 */
const PlanLimitsPanel = () => {
  const { t } = useTranslation()
  const resource = useAdminResource(() => getTierLimits())
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const data = resource.data

  useEffect(() => {
    if (data) setDraft(draftFrom(data.tierLimits))
  }, [data])

  if (resource.loading || !draft) {
    return <Skeleton className="h-72 w-full rounded-3xl" />
  }

  const groups = data.groups
  const patchGroup = (id, plan, change) =>
    setDraft(d => ({
      ...d,
      groups: {
        ...d.groups,
        [id]: plan
          ? { ...d.groups[id], [plan]: { ...d.groups[id][plan], ...change } }
          : { ...d.groups[id], ...change }
      }
    }))
  const patchCaps = change =>
    setDraft(d => ({
      ...d,
      caps: { ...d.caps, free: { ...d.caps.free, ...change } }
    }))
  const fasting = draft.caps.free.fastingPlans || []
  const invalid = hasErrors(draft)

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveTierLimits(payloadFrom(draft))
      await resource.reload()
      setMessage({ tone: 'ok', text: t('admin.ai.plan.saved') })
    } catch (error) {
      setMessage({
        tone: 'bad',
        text:
          error.code === 'SETTINGS_TABLE_MISSING'
            ? t('admin.ai.tableMissing')
            : t('admin.ai.saveFailed', {
                details: (error.details || [error.message]).join('; ')
              })
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      subtitle={t('admin.ai.plan.hint')}
      onRefresh={() => resource.reload()}
      refreshing={resource.refreshing}
      refreshLabel={t('admin.common.refresh')}
    >
      {!data.meta?.saved ? (
        <p className="mb-3 text-xs text-slate-500">
          {t('admin.ai.plan.builtIn')}
        </p>
      ) : null}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th scope="col" className="px-2 py-2">
                {t('admin.ai.plan.group')}
              </th>
              <th scope="col" className="px-2 py-2">
                {t('admin.ai.plan.free')}
              </th>
              <th scope="col" className="px-2 py-2">
                {t('admin.ai.plan.premium')}
              </th>
              <th scope="col" className="px-2 py-2">
                {t('admin.ai.plan.burst')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map(g => {
              const v = draft.groups[g.id]
              const label = t(`admin.ai.limits.groups.${g.id}`)
              return (
                <tr key={g.id}>
                  <th scope="row" className="px-2 py-2.5 font-medium">
                    <span className="block text-slate-900">{label}</span>
                    <span className="block text-xs font-normal text-slate-500">
                      {g.clientEnforced
                        ? t('admin.ai.plan.clientEnforced')
                        : g.features.join(', ')}
                    </span>
                  </th>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <LimitInput
                        id={`tier-${g.id}-free`}
                        label={`${label} ${t('admin.ai.plan.free')}`}
                        value={v.free.limit}
                        placeholder={
                          g.ai ? t('admin.ai.plan.fairUseOnly') : '∞'
                        }
                        onChange={limit => patchGroup(g.id, 'free', { limit })}
                      />
                      <PeriodSelect
                        id={`tier-${g.id}-free-p`}
                        label={`${label} ${t('admin.ai.limits.periodLabel')}`}
                        value={v.free.period}
                        onChange={period =>
                          patchGroup(g.id, 'free', { period })
                        }
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <LimitInput
                        id={`tier-${g.id}-premium`}
                        label={`${label} ${t('admin.ai.plan.premium')}`}
                        value={v.premium.limit}
                        placeholder="∞"
                        onChange={limit =>
                          patchGroup(g.id, 'premium', { limit })
                        }
                      />
                      <PeriodSelect
                        id={`tier-${g.id}-premium-p`}
                        label={`${label} ${t('admin.ai.limits.periodLabel')}`}
                        value={v.premium.period}
                        onChange={period =>
                          patchGroup(g.id, 'premium', { period })
                        }
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    {g.ai ? (
                      <LimitInput
                        id={`tier-${g.id}-burst`}
                        label={`${label} ${t('admin.ai.plan.burst')}`}
                        value={v.burstPerMinute}
                        placeholder="∞"
                        onChange={burstPerMinute =>
                          patchGroup(g.id, null, { burstPerMinute })
                        }
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {t('admin.ai.plan.premiumHint')}
      </p>

      <fieldset className="mt-5 rounded-2xl border border-slate-200 p-4">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {t('admin.ai.plan.freeCaps')}
        </legend>
        <div className="flex flex-wrap items-end gap-4">
          {CAP_FIELDS.map(f => (
            <div key={f}>
              <label
                htmlFor={`cap-${f}`}
                className="mb-1 block text-xs text-slate-500"
              >
                {t(`admin.ai.plan.caps.${f}`)}
              </label>
              <input
                id={`cap-${f}`}
                inputMode="numeric"
                value={draft.caps.free[f]}
                placeholder="∞"
                onChange={e => patchCaps({ [f]: e.target.value.trim() })}
                aria-invalid={badNumber(draft.caps.free[f])}
                className={`${inputClass} af-num w-24 ${badNumber(draft.caps.free[f]) ? 'border-rose-300' : ''}`}
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.caps.free.perDayGoals === true}
              onChange={e => patchCaps({ perDayGoals: e.target.checked })}
              className="af-focus h-4 w-4 rounded border-slate-300 accent-violet-600"
            />
            {t('admin.ai.plan.caps.perDayGoals')}
          </label>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-xs text-slate-500">
            {t('admin.ai.plan.caps.fastingPlans')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FASTING_PLANS.map(p => {
              const on = fasting.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    patchCaps({
                      fastingPlans: on
                        ? fasting.filter(x => x !== p)
                        : [...fasting, p]
                    })
                  }
                  className={`af-focus af-press rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-[160ms] motion-reduce:transition-none ${
                    on
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-violet-300'
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-4 rounded-2xl border border-slate-200 p-4">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {t('admin.ai.plan.chatCaps')}
        </legend>
        <p className="mb-3 text-xs text-slate-500">
          {t('admin.ai.plan.chatCapsHint')}
        </p>
        <div className="flex flex-wrap items-end gap-4">
          {CHAT_CAP_FIELDS.map(f => (
            <div key={f}>
              <label
                htmlFor={`cap-${f}`}
                className="mb-1 block text-xs text-slate-500"
              >
                {t(`admin.ai.plan.caps.${f}`)}
              </label>
              <input
                id={`cap-${f}`}
                inputMode="numeric"
                value={draft.caps.free[f]}
                placeholder="∞"
                onChange={e => patchCaps({ [f]: e.target.value.trim() })}
                aria-invalid={badCap(draft, f)}
                className={`${inputClass} af-num w-24 ${badCap(draft, f) ? 'border-rose-300' : ''}`}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex items-center justify-end gap-3">
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
          disabled={saving}
          onClick={() => setDraft(draftFrom(data.builtIn))}
          className="af-focus af-press rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
        >
          {t('admin.ai.plan.useBuiltIn')}
        </button>
        <button
          type="button"
          disabled={saving || invalid}
          onClick={save}
          className="af-focus af-press rounded-full bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? t('admin.ai.saving') : t('admin.ai.save')}
        </button>
      </div>
    </Panel>
  )
}

export default PlanLimitsPanel
