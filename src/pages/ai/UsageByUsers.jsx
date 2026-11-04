import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

import Panel from '../../components/admin/Panel'
import Skeleton from '../../components/admin/Skeleton'
import SortHeader from '../../components/admin/SortHeader'
import {
  formatAgo,
  formatNumber,
  formatPercent,
  formatUsd
} from '../../components/admin/format'
import { useNow } from '../../components/admin/motion'
import { useSort } from '../../components/admin/sortable'
import useAdminResource from '../../components/admin/useAdminResource'
import { getAiUsageByUsers } from '../../services/adminApi'

const DAY_MS = 86_400_000
const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

export const dateInput = date => new Date(date).toISOString().slice(0, 10)

/** [from, to) ISO strings for two yyyy-mm-dd inputs (to is inclusive). */
export const rangeFromInputs = (fromDay, toDay) => ({
  from: new Date(`${fromDay}T00:00:00Z`).toISOString(),
  to: new Date(new Date(`${toDay}T00:00:00Z`).getTime() + DAY_MS).toISOString()
})

export const PlanBadge = ({ plan }) => {
  const { t } = useTranslation()
  const tone =
    plan === 'premium'
      ? 'bg-violet-100 text-violet-800'
      : plan === 'admin'
        ? 'bg-slate-900 text-white'
        : 'bg-slate-100 text-slate-600'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {t(`admin.ai.users.plan.${plan || 'free'}`)}
    </span>
  )
}

const inputClass =
  'af-focus rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm hover:border-violet-300'

/**
 * Admin › AI › Usage by user: who spends what. Server-side search, sort and
 * paging; a row opens the user drawer.
 */
const UsageByUsers = ({ rangeDays, featureLabel, onOpenUser }) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const now = useNow()
  const [fromDay, setFromDay] = useState(() =>
    dateInput(Date.now() - rangeDays * DAY_MS)
  )
  const [toDay, setToDay] = useState(() => dateInput(Date.now()))
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const sort = useSort('cost', 'desc')

  // Follow the page's 7/30/90 switch.
  useEffect(() => {
    setFromDay(dateInput(Date.now() - rangeDays * DAY_MS))
    setToDay(dateInput(Date.now()))
  }, [rangeDays])

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(0)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const usage = useAdminResource(() =>
    getAiUsageByUsers({
      ...rangeFromInputs(fromDay, toDay),
      search,
      sort: sort.key,
      direction: sort.direction,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE
    })
  )
  const { reload } = usage
  // The hook already loads on mount; reload only when a filter changes.
  const firstLoad = useRef(true)
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }
    reload()
  }, [fromDay, toDay, search, sort.key, sort.direction, page, reload])

  const rows = useMemo(() => usage.data?.rows || [], [usage.data])
  const total = usage.data?.total || 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const toggleSort = key => {
    sort.toggle(key)
    setPage(0)
  }
  const sortState = { ...sort, toggle: toggleSort }

  return (
    <Panel
      onRefresh={() => reload()}
      refreshing={usage.refreshing}
      refreshLabel={t('admin.common.refresh')}
      updatedAt={usage.updatedAt}
      subtitle={t('admin.ai.users.hint')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">{t('admin.ai.users.search')}</span>
            <MagnifyingGlassIcon
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={t('admin.ai.users.search')}
              className={`${inputClass} w-56 pl-8`}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <span className="sr-only">{t('admin.ai.users.from')}</span>
            <input
              type="date"
              value={fromDay}
              max={toDay}
              onChange={e => {
                if (e.target.value) {
                  setFromDay(e.target.value)
                  setPage(0)
                }
              }}
              className={inputClass}
            />
          </label>
          <span aria-hidden className="text-slate-400">
            –
          </span>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <span className="sr-only">{t('admin.ai.users.to')}</span>
            <input
              type="date"
              value={toDay}
              min={fromDay}
              onChange={e => {
                if (e.target.value) {
                  setToDay(e.target.value)
                  setPage(0)
                }
              }}
              className={inputClass}
            />
          </label>
        </div>
      }
    >
      {usage.error ? (
        <p role="alert" className="mb-3 text-sm text-rose-700">
          {usage.error.code === 'USAGE_TABLE_MISSING'
            ? t('admin.ai.usageTableMissing')
            : t('admin.ai.users.loadFailed')}
        </p>
      ) : null}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-[11px] font-semibold text-slate-400">
            <tr>
              <SortHeader column="name" sort={sortState}>
                {t('admin.ai.users.user')}
              </SortHeader>
              <th scope="col" className="py-2 pr-4 uppercase tracking-[0.14em]">
                {t('admin.ai.users.planColumn')}
              </th>
              <SortHeader column="calls" sort={sortState} align="right">
                {t('admin.ai.calls')}
              </SortHeader>
              <SortHeader column="okRate" sort={sortState} align="right">
                {t('admin.ai.users.okRate')}
              </SortHeader>
              <SortHeader column="cost" sort={sortState} align="right">
                {t('admin.ai.cost')}
              </SortHeader>
              <th scope="col" className="py-2 pr-4 uppercase tracking-[0.14em]">
                {t('admin.ai.users.topFeature')}
              </th>
              <SortHeader column="lastCall" sort={sortState}>
                {t('admin.ai.users.lastCall')}
              </SortHeader>
            </tr>
          </thead>
          <tbody
            className={`af-fade divide-y divide-slate-100 ${usage.refreshing ? 'opacity-55' : ''}`}
          >
            {usage.loading
              ? [0, 1, 2, 3, 4].map(i => (
                  <tr key={i}>
                    <td colSpan={7} className="py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map(row => (
                  <tr
                    key={row.userId}
                    onClick={() => onOpenUser(row.userId)}
                    className="cursor-pointer transition-colors duration-[160ms] hover:bg-violet-50/60 motion-reduce:transition-none"
                  >
                    <td className="max-w-[240px] py-2.5 pr-4">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          onOpenUser(row.userId)
                        }}
                        className="af-focus block max-w-full rounded text-left"
                      >
                        <span className="block truncate font-medium text-slate-900">
                          {row.name || row.email || row.userId}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {row.email || row.userId}
                        </span>
                      </button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-1.5">
                        <PlanBadge plan={row.plan} />
                        {row.hasOverride ? (
                          <span
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                            title={t('admin.ai.users.overrideHint')}
                          >
                            {t('admin.ai.users.override')}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="af-num py-2.5 pr-4 text-right">
                      {formatNumber(row.calls, locale)}
                    </td>
                    <td
                      className={`af-num py-2.5 pr-4 text-right ${
                        row.okRate !== null && row.okRate < 0.9
                          ? 'text-rose-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {formatPercent(row.okRate, locale)}
                    </td>
                    <td className="af-num py-2.5 pr-4 text-right font-semibold text-slate-900">
                      {formatUsd(row.costUsd, locale)}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {row.topFeature ? featureLabel(row.topFeature) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">
                      {formatAgo(row.lastCallAt, now, locale) || '—'}
                    </td>
                  </tr>
                ))}
            {!usage.loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400">
                  {search ? t('admin.ai.users.noMatch') : t('admin.ai.noUsage')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {total > PAGE_SIZE ? (
        <nav
          aria-label={t('admin.ai.users.pages')}
          className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-500"
        >
          <span className="af-num">
            {t('admin.ai.users.pageOf', { page: page + 1, pages })}
          </span>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="af-focus af-press rounded-full border border-slate-200 p-1.5 hover:border-violet-300 disabled:opacity-40"
            aria-label={t('admin.ai.users.previous')}
          >
            <ChevronLeftIcon className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
            className="af-focus af-press rounded-full border border-slate-200 p-1.5 hover:border-violet-300 disabled:opacity-40"
            aria-label={t('admin.ai.users.next')}
          >
            <ChevronRightIcon className="h-4 w-4" aria-hidden />
          </button>
        </nav>
      ) : null}
    </Panel>
  )
}

export default UsageByUsers
