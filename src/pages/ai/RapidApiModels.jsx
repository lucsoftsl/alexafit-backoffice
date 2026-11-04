import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CloudArrowDownIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

import SortHeader from '../../components/admin/SortHeader'
import {
  formatAgo,
  formatMs,
  formatNumber,
  formatPercent,
  formatUsd
} from '../../components/admin/format'
import { useNow } from '../../components/admin/motion'
import { sortRows, useSort } from '../../components/admin/sortable'
import { refreshRapidApiModels } from '../../services/adminApi'

const PROVIDER_ID = 'rapidapi-chatgpt'
const PREFIX = 'rapidapi/'

/** Requests, % ok and average latency per model from the loaded aiCalls rows. */
export const rapidApiRecords = usage => {
  const map = new Map()
  for (const row of usage?.rows || []) {
    if (row.provider !== PROVIDER_ID) continue
    const acc = map.get(row.model) || { calls: 0, errors: 0, latencySum: 0 }
    map.set(row.model, {
      calls: acc.calls + row.calls,
      errors: acc.errors + row.errors,
      latencySum: acc.latencySum + (row.avgLatencyMs || 0) * row.calls
    })
  }
  return new Map(
    [...map].map(([model, r]) => [
      model,
      {
        calls: r.calls,
        okRate: r.calls ? (r.calls - r.errors) / r.calls : null,
        avgLatencyMs: r.calls ? r.latencySum / r.calls : null
      }
    ])
  )
}

/** "Recipe instructions main · AI chat backup" for every feature using a model. */
export const rapidApiRoles = (features, effectiveById, featureLabel, t) => {
  const roles = new Map()
  const add = (model, text) =>
    roles.set(model, [...(roles.get(model) || []), text])
  for (const f of features) {
    const effective = effectiveById[f.id]
    if (!effective) continue
    if (effective.primary?.provider === PROVIDER_ID) {
      add(
        effective.primary.model,
        t('admin.ai.rapid.roleMain', { feature: featureLabel(f.id) })
      )
    }
    if (effective.fallback?.provider === PROVIDER_ID) {
      add(
        effective.fallback.model,
        t('admin.ai.rapid.roleBackup', { feature: featureLabel(f.id) })
      )
    }
  }
  return roles
}

const FetchedNote = ({ fetchedAt }) => {
  const { t, i18n } = useTranslation()
  const now = useNow()
  if (!fetchedAt) {
    return (
      <span className="text-xs text-slate-500">
        {t('admin.ai.rapid.notFetched')}
      </span>
    )
  }
  return (
    <time
      dateTime={fetchedAt}
      title={new Date(fetchedAt).toLocaleString(i18n.language)}
      className="text-xs text-slate-500"
    >
      {t('admin.ai.rapid.fetchedAt', {
        ago: formatAgo(fetchedAt, now, i18n.language)
      })}
    </time>
  )
}

const Record = ({ record, locale }) => {
  const { t } = useTranslation()
  if (!record) {
    return <span className="text-slate-400">{t('admin.ai.rapid.notUsed')}</span>
  }
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="text-slate-800">
        {t('admin.ai.rapid.requests', {
          count: record.calls,
          formatted: formatNumber(record.calls, locale)
        })}
      </span>
      <span
        className={
          record.okRate !== null && record.okRate < 0.8
            ? 'font-semibold text-rose-700'
            : 'text-slate-500'
        }
      >
        {t('admin.ai.rapid.okRate', {
          rate: formatPercent(record.okRate, locale, 0)
        })}
      </span>
      <span className="text-slate-500">
        {t('admin.ai.rapid.avgLatency', {
          latency: formatMs(record.avgLatencyMs)
        })}
      </span>
    </span>
  )
}

/**
 * Admin › AI: the models reachable through the RapidAPI plan. The plan is
 * flat-rate, so each model shows the vendor's own list price per 1M tokens
 * for reference only (what tier the flat rate buys), plus its record here.
 * The list is fetched only when the admin presses the button: one request on
 * the plan.
 */
const RapidApiModels = ({
  rapidapi,
  features,
  effectiveById,
  featureLabel,
  usage,
  onRefreshed
}) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const sort = useSort('family')

  const records = useMemo(() => rapidApiRecords(usage), [usage])
  const roles = useMemo(
    () => rapidApiRoles(features, effectiveById, featureLabel, t),
    [features, effectiveById, featureLabel, t]
  )

  const rows = useMemo(() => {
    const value = entry => {
      if (sort.key === 'model') return entry.model
      if (sort.key === 'family') return `${entry.family} ${entry.model}`
      if (sort.key === 'thinking') return entry.reasoning || null
      if (sort.key === 'input') return entry.reference?.input ?? null
      if (sort.key === 'output') return entry.reference?.output ?? null
      return records.get(entry.model)?.calls ?? null
    }
    const inUse = entry => (roles.has(entry.model) ? 1 : 0)
    // The models in use first, whatever the order.
    return sortRows(rapidapi?.rows || [], value, sort.direction).sort(
      (a, b) => inUse(b) - inUse(a)
    )
  }, [rapidapi, sort.key, sort.direction, records, roles])

  const handleFetch = async () => {
    if (!window.confirm(t('admin.ai.rapid.fetchConfirm'))) return
    setFetching(true)
    setFetchError(null)
    try {
      await refreshRapidApiModels()
      onRefreshed?.()
    } catch (error) {
      setFetchError(
        error.code === 'RAPIDAPI_NOT_CONFIGURED'
          ? t('admin.ai.rapid.notConfigured')
          : t('admin.ai.rapid.fetchFailed', {
              message: (error.details || [error.message]).join('; ')
            })
      )
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500">
          {t('admin.ai.rapid.hint')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <FetchedNote fetchedAt={rapidapi?.fetchedAt} />
          <button
            type="button"
            onClick={handleFetch}
            disabled={fetching || !rapidapi?.configured}
            aria-busy={fetching}
            className="af-press af-focus inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold text-violet-800 hover:border-violet-400 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CloudArrowDownIcon
              className={`h-4 w-4 ${fetching ? 'animate-pulse' : ''}`}
              aria-hidden
            />
            {fetching
              ? t('admin.ai.rapid.fetching')
              : t('admin.ai.rapid.fetch')}
          </button>
        </div>
      </div>

      {!rapidapi?.configured ? (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('admin.ai.rapid.notConfigured')}
        </p>
      ) : null}
      {fetchError ? (
        <p
          role="alert"
          className="af-enter mb-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden />
          {fetchError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          {t('admin.ai.rapid.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">{t('admin.ai.rapid.title')}</caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <SortHeader column="model" sort={sort}>
                  {t('admin.ai.model')}
                </SortHeader>
                <SortHeader column="family" sort={sort}>
                  {t('admin.ai.rapid.family')}
                </SortHeader>
                <SortHeader column="thinking" sort={sort}>
                  {t('admin.ai.rapid.thinking')}
                </SortHeader>
                <SortHeader column="input" sort={sort} align="right">
                  {t('admin.ai.rapid.listIn')}
                </SortHeader>
                <SortHeader column="output" sort={sort} align="right">
                  {t('admin.ai.rapid.listOut')}
                </SortHeader>
                <SortHeader column="record" sort={sort} align="right">
                  {t('admin.ai.rapid.record')}
                </SortHeader>
              </tr>
            </thead>
            <tbody>
              {rows.map(entry => {
                const role = roles.get(entry.model)
                return (
                  <tr
                    key={entry.model}
                    className={`border-b border-slate-100 align-top transition-colors hover:bg-violet-50/60 ${
                      role ? 'bg-violet-50/40' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-xs text-slate-800">
                        {entry.model.slice(PREFIX.length)}
                      </span>
                      {role ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {role.map(text => (
                            <span
                              key={text}
                              className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                            >
                              {text}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-sm py-2.5 pr-4 text-xs text-slate-600">
                      <span className="font-semibold uppercase tracking-wide text-slate-800">
                        {t(`admin.ai.rapid.familyName.${entry.family}`)}
                      </span>
                      <p className="mt-0.5">
                        {t(`admin.ai.rapid.familyText.${entry.family}`)}
                      </p>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">
                      {entry.reasoning
                        ? t(`admin.ai.rapid.level.${entry.reasoning}`)
                        : t('admin.ai.rapid.level.standard')}
                    </td>
                    <td className="af-num py-2.5 pr-4 text-right text-xs">
                      {entry.reference ? (
                        formatUsd(entry.reference.input, locale)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="af-num py-2.5 pr-4 text-right text-xs">
                      {entry.reference ? (
                        formatUsd(entry.reference.output, locale)
                      ) : (
                        <span className="text-slate-400">
                          {t('admin.ai.rapid.notInList')}
                        </span>
                      )}
                      {entry.reference?.retires ? (
                        <span className="mt-0.5 block text-amber-700">
                          {t('admin.ai.rapid.retires', {
                            date: entry.reference.retires
                          })}
                        </span>
                      ) : null}
                    </td>
                    <td className="af-num py-2.5 text-right text-xs">
                      <Record
                        record={records.get(entry.model)}
                        locale={locale}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {t('admin.ai.rapid.flatRateNote')}
      </p>
    </div>
  )
}

export default RapidApiModels
