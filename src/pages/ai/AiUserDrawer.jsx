import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { XMarkIcon } from '@heroicons/react/24/outline'

import Skeleton from '../../components/admin/Skeleton'
import StatTile from '../../components/admin/StatTile'
import {
  axisProps,
  colorForKey,
  gridProps,
  MAX_SERIES,
  SERIES,
  STATUS,
  tooltipProps
} from '../../components/admin/chartTheme'
import {
  formatMs,
  formatNumber,
  formatUsd
} from '../../components/admin/format'
import { chartAnimation } from '../../components/admin/motion'
import useAdminResource from '../../components/admin/useAdminResource'
import { getAiUserUsage } from '../../services/adminApi'

import { PlanBadge } from './UsageByUsers'
import UserLimitsEditor from './UserLimitsEditor'

const DAY_MS = 86_400_000
const RANGES = [7, 30, 90]

const shortDay = (day, locale) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  })

const daysBetween = (from, to) => {
  const out = []
  const d = new Date(`${from.slice(0, 10)}T00:00:00Z`)
  const end = new Date(`${to.slice(0, 10)}T00:00:00Z`)
  while (d <= end && out.length < 400) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

const SectionTitle = ({ children }) => (
  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
    {children}
  </h3>
)

const Chart = ({ loading, empty, label, children }) => {
  if (loading) return <Skeleton className="h-52 w-full" />
  if (empty) {
    return (
      <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
        {label}
      </div>
    )
  }
  return (
    <div className="h-52 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/** Turns the per-day × feature rows into chart series. */
const useSeries = data =>
  useMemo(() => {
    if (!data) return { byDay: [], costByDay: [], features: [] }
    const days = daysBetween(data.range.from, data.range.to)
    const totals = new Map()
    for (const r of data.rows) {
      totals.set(r.feature, (totals.get(r.feature) || 0) + r.calls)
    }
    const features = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([f]) => f)
    const byDay = new Map(days.map(d => [d, { day: d, cost: 0 }]))
    for (const r of data.rows) {
      const entry = byDay.get(r.day)
      if (!entry) continue
      byDay.set(r.day, {
        ...entry,
        [r.feature]: (entry[r.feature] || 0) + r.calls,
        cost: entry.cost + r.costUsd
      })
    }
    const list = days.map(d => byDay.get(d))
    return { byDay: list, costByDay: list, features }
  }, [data])

/**
 * Right-hand drawer for one user: AI calls per day by feature, cost per day,
 * the last 50 calls (no prompt contents) and the limits editor. Escape or
 * the backdrop closes it; focus moves in on open and back on close.
 */
const AiUserDrawer = ({ userId, onClose, featureLabel: labelProp, children }) => {
  const { t, i18n } = useTranslation()
  // Outside Admin › AI (user detail modal) there are no server labels.
  const featureLabel =
    labelProp || (id => t(`admin.ai.featureNames.${id}`, { defaultValue: id }))
  const locale = i18n.language
  const [rangeDays, setRangeDays] = useState(30)
  const closeRef = useRef(null)
  const anim = useMemo(() => chartAnimation(), [])

  const usage = useAdminResource(() =>
    getAiUserUsage(userId, {
      from: new Date(Date.now() - rangeDays * DAY_MS).toISOString(),
      to: new Date().toISOString()
    })
  )
  const { reload } = usage
  const firstLoad = useRef(true)
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }
    reload()
  }, [rangeDays, userId, reload])

  // A ref, so an inline onClose from the parent doesn't re-run the effect
  // (which would steal focus on every render).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const onKey = e => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previous instanceof window.HTMLElement) previous.focus()
    }
  }, [])

  const data = usage.data
  const { byDay, costByDay, features } = useSeries(data)
  const colored = features.slice(0, MAX_SERIES)
  const empty = !data || data.totals.calls === 0
  const dayTick = d => shortDay(d, locale)
  const titleId = 'ai-user-drawer-title'

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div
        aria-hidden
        className="af-backdrop absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="af-drawer relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-600">
              {t('admin.ai.drawer.eyebrow')}
            </p>
            <h2
              id={titleId}
              className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900"
            >
              {data?.user?.name || data?.user?.email || userId}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {data?.user?.email ? <span>{data.user.email}</span> : null}
              <span className="font-mono text-xs">{userId}</span>
              {data?.user ? <PlanBadge plan={data.user.plan} /> : null}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              role="tablist"
              aria-label={t('admin.ai.range')}
              className="flex rounded-full border border-slate-200 bg-white p-1"
            >
              {RANGES.map(days => (
                <button
                  key={days}
                  type="button"
                  role="tab"
                  aria-selected={rangeDays === days}
                  onClick={() => setRangeDays(days)}
                  className={`af-focus af-press rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    rangeDays === days
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('admin.ai.lastDays', { count: days })}
                </button>
              ))}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t('admin.ai.drawer.close')}
              className="af-focus af-press rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <XMarkIcon className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {children}
          {usage.error ? (
            <p role="alert" className="text-sm text-rose-700">
              {usage.error.code === 'USAGE_TABLE_MISSING'
                ? t('admin.ai.usageTableMissing')
                : t('admin.ai.users.loadFailed')}
            </p>
          ) : null}

          <section className="grid grid-cols-3 gap-3">
            <StatTile
              label={t('admin.ai.cost')}
              value={data ? data.totals.costUsd : null}
              format={v => formatUsd(v, locale)}
              loading={usage.loading}
            />
            <StatTile
              label={t('admin.ai.calls')}
              value={data ? data.totals.calls : null}
              format={v => formatNumber(v, locale)}
              loading={usage.loading}
            />
            <StatTile
              label={t('admin.ai.errors')}
              value={data ? data.totals.errors : null}
              format={v => formatNumber(v, locale)}
              tone={data?.totals.errors ? 'warn' : 'default'}
              loading={usage.loading}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <SectionTitle>{t('admin.ai.callsPerDay')}</SectionTitle>
            <Chart
              loading={usage.loading}
              empty={empty}
              label={t('admin.ai.noUsage')}
            >
              <BarChart data={byDay} barCategoryGap="20%">
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="day"
                  tickFormatter={dayTick}
                  {...axisProps}
                  minTickGap={16}
                />
                <YAxis allowDecimals={false} {...axisProps} width={36} />
                <Tooltip
                  {...tooltipProps}
                  labelFormatter={dayTick}
                  formatter={(value, key) => [value, featureLabel(key)]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={key => (
                    <span className="text-slate-600">{featureLabel(key)}</span>
                  )}
                />
                {features.map((key, i) => (
                  <Bar
                    key={key}
                    {...anim}
                    dataKey={key}
                    stackId="calls"
                    fill={colorForKey(key, colored)}
                    stroke="#fff"
                    strokeWidth={1}
                    radius={i === features.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </Chart>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <SectionTitle>{t('admin.ai.costPerDay')}</SectionTitle>
            <Chart
              loading={usage.loading}
              empty={empty}
              label={t('admin.ai.noUsage')}
            >
              <AreaChart data={costByDay}>
                <defs>
                  <linearGradient
                    id="ai-user-cost-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={SERIES[6]}
                      stopOpacity={0.28}
                    />
                    <stop offset="100%" stopColor={SERIES[6]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="day"
                  tickFormatter={dayTick}
                  {...axisProps}
                  minTickGap={24}
                />
                <YAxis
                  {...axisProps}
                  width={56}
                  tickFormatter={v => formatUsd(v, locale)}
                />
                <Tooltip
                  {...tooltipProps}
                  labelFormatter={dayTick}
                  formatter={v => [formatUsd(v, locale), t('admin.ai.cost')]}
                />
                <Area
                  {...anim}
                  type="monotone"
                  dataKey="cost"
                  stroke={SERIES[6]}
                  strokeWidth={2}
                  fill="url(#ai-user-cost-fill)"
                />
              </AreaChart>
            </Chart>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <SectionTitle>{t('admin.ai.limits.title')}</SectionTitle>
            <UserLimitsEditor
              key={userId}
              userId={userId}
              plan={data?.user?.plan === 'premium' ? 'premium' : 'free'}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <SectionTitle>{t('admin.ai.drawer.lastCalls')}</SectionTitle>
            {usage.loading ? (
              <Skeleton className="h-40 w-full" />
            ) : data?.lastCalls?.length ? (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <tr>
                      <th scope="col" className="px-2 py-2">
                        {t('admin.ai.drawer.when')}
                      </th>
                      <th scope="col" className="px-2 py-2">
                        {t('admin.ai.drawer.feature')}
                      </th>
                      <th scope="col" className="px-2 py-2">
                        {t('admin.ai.model')}
                      </th>
                      <th scope="col" className="px-2 py-2">
                        {t('admin.ai.drawer.status')}
                      </th>
                      <th scope="col" className="px-2 py-2 text-right">
                        {t('admin.ai.drawer.latency')}
                      </th>
                      <th scope="col" className="px-2 py-2 text-right">
                        {t('admin.ai.cost')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.lastCalls.map((c, i) => (
                      <tr key={`${c.createdAt}-${i}`}>
                        <td className="af-num whitespace-nowrap px-2 py-1.5 text-slate-500">
                          {new Date(c.createdAt).toLocaleString(locale)}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">
                          {featureLabel(c.feature)}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500">
                          {c.model}
                          {c.isFallback ? (
                            <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">
                              {t('admin.ai.fallback')}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className="inline-flex items-center gap-1 font-medium"
                            style={{ color: c.ok ? STATUS.ok : STATUS.bad }}
                          >
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                background: c.ok ? STATUS.ok : STATUS.bad
                              }}
                            />
                            {c.ok
                              ? t('admin.ai.drawer.ok')
                              : c.errorCode || t('admin.ai.errors')}
                          </span>
                        </td>
                        <td className="af-num px-2 py-1.5 text-right text-slate-600">
                          {formatMs(c.latencyMs)}
                        </td>
                        <td className="af-num px-2 py-1.5 text-right text-slate-700">
                          {c.costUsd === null
                            ? '—'
                            : formatUsd(c.costUsd, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">{t('admin.ai.noUsage')}</p>
            )}
          </section>
        </div>
      </aside>
    </div>,
    document.body
  )
}

export default AiUserDrawer
