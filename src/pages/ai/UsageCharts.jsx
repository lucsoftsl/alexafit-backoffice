import { useMemo } from 'react'
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

import Panel from '../../components/admin/Panel'
import Skeleton from '../../components/admin/Skeleton'
import {
  axisProps,
  gridProps,
  OTHER_COLOR,
  SERIES,
  STATUS,
  tooltipProps
} from '../../components/admin/chartTheme'
import { formatMs, formatUsd } from '../../components/admin/format'
import { chartAnimation } from '../../components/admin/motion'

const OTHER = '__other'

const shortDay = (day, locale) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  })

/** Every day in the range, so quiet days show as zero rather than vanishing. */
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

const ChartFrame = ({
  loading,
  empty,
  emptyLabel,
  children,
  height = 'h-60'
}) => {
  if (loading) return <Skeleton className={`${height} w-full`} />
  if (empty) {
    return (
      <div
        className={`${height} flex items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400`}
      >
        {emptyLabel}
      </div>
    )
  }
  return (
    <div className={`${height} min-w-0`}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Calls/day by feature (stacked, fixed feature colors, rare features folded
 * into "Other"), cost/day, errors & fallbacks/day, latency p50/p95 by feature.
 * One measure per chart — never two y-axes.
 */
const UsageCharts = ({
  usage,
  loading,
  coloredFeatureIds,
  colorFor,
  featureLabel
}) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const anim = useMemo(() => chartAnimation(), [])

  const { callsByDay, perDay, latency, seriesKeys } = useMemo(() => {
    if (!usage)
      return { callsByDay: [], perDay: [], latency: [], seriesKeys: [] }
    const days = daysBetween(usage.range.from, usage.range.to)
    const keyOf = f => (coloredFeatureIds.includes(f) ? f : OTHER)
    const byDay = new Map(days.map(d => [d, { day: d }]))
    const present = new Set()
    for (const row of usage.rows) {
      const entry = byDay.get(row.day)
      if (!entry) continue
      const key = keyOf(row.feature)
      present.add(key)
      byDay.set(row.day, { ...entry, [key]: (entry[key] || 0) + row.calls })
    }
    const totals = new Map(usage.byDay.map(d => [d.day, d]))
    const ordered = [...coloredFeatureIds, OTHER].filter(k => present.has(k))
    return {
      seriesKeys: ordered,
      callsByDay: days.map(d => byDay.get(d)),
      perDay: days.map(d => ({
        day: d,
        cost: totals.get(d)?.costUsd || 0,
        errors: totals.get(d)?.errors || 0,
        fallbacks: totals.get(d)?.fallbackCalls || 0
      })),
      latency: usage.byFeature
        .filter(f => f.calls > 0)
        .map(f => ({
          feature: featureLabel(f.feature),
          p50: f.latency?.p50 || 0,
          p95: f.latency?.p95 || 0
        }))
        .sort((a, b) => b.p95 - a.p95)
    }
  }, [usage, coloredFeatureIds, featureLabel])

  const empty = !usage || usage.totals.calls === 0
  const emptyLabel = t('admin.ai.noUsage')
  const dayTick = d => shortDay(d, locale)
  const labelForKey = key =>
    key === OTHER ? t('admin.ai.otherFeatures') : featureLabel(key)

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel
        title={t('admin.ai.callsPerDay')}
        subtitle={t('admin.ai.callsPerDayHint')}
        className="xl:col-span-8"
      >
        <ChartFrame
          loading={loading}
          empty={empty}
          emptyLabel={emptyLabel}
          height="h-72"
        >
          <BarChart data={callsByDay} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="day"
              tickFormatter={dayTick}
              {...axisProps}
              minTickGap={16}
            />
            <YAxis allowDecimals={false} {...axisProps} width={44} />
            <Tooltip
              {...tooltipProps}
              labelFormatter={dayTick}
              formatter={(value, key) => [value, labelForKey(key)]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={key => (
                <span className="text-slate-600">{labelForKey(key)}</span>
              )}
            />
            {seriesKeys.map((key, i) => (
              <Bar
                key={key}
                {...anim}
                dataKey={key}
                stackId="calls"
                fill={key === OTHER ? OTHER_COLOR : colorFor(key)}
                stroke="#fff"
                strokeWidth={1}
                radius={i === seriesKeys.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ChartFrame>
      </Panel>

      <Panel
        title={t('admin.ai.costPerDay')}
        subtitle={t('admin.ai.costPerDayHint')}
        className="xl:col-span-4"
      >
        <ChartFrame
          loading={loading}
          empty={empty}
          emptyLabel={emptyLabel}
          height="h-72"
        >
          <AreaChart data={perDay}>
            <defs>
              <linearGradient id="ai-cost-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[6]} stopOpacity={0.28} />
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
              fill="url(#ai-cost-fill)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ChartFrame>
      </Panel>

      <Panel
        title={t('admin.ai.errorsPerDay')}
        subtitle={t('admin.ai.errorsPerDayHint')}
        className="xl:col-span-6"
      >
        <ChartFrame loading={loading} empty={empty} emptyLabel={emptyLabel}>
          <BarChart data={perDay} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="day"
              tickFormatter={dayTick}
              {...axisProps}
              minTickGap={16}
            />
            <YAxis allowDecimals={false} {...axisProps} width={36} />
            <Tooltip {...tooltipProps} labelFormatter={dayTick} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar
              {...anim}
              dataKey="errors"
              name={t('admin.ai.errors')}
              fill={STATUS.bad}
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
            />
            <Bar
              {...anim}
              dataKey="fallbacks"
              name={t('admin.ai.fallbacks')}
              fill={STATUS.warn}
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
            />
          </BarChart>
        </ChartFrame>
      </Panel>

      <Panel
        title={t('admin.ai.latency')}
        subtitle={t('admin.ai.latencyHint')}
        className="xl:col-span-6"
      >
        <ChartFrame
          loading={loading}
          empty={empty || latency.length === 0}
          emptyLabel={emptyLabel}
        >
          <BarChart
            data={latency}
            layout="vertical"
            barGap={2}
            margin={{ left: 8 }}
          >
            <CartesianGrid {...gridProps} vertical horizontal={false} />
            <XAxis type="number" {...axisProps} tickFormatter={formatMs} />
            <YAxis
              type="category"
              dataKey="feature"
              width={150}
              {...axisProps}
            />
            <Tooltip
              {...tooltipProps}
              formatter={(v, name) => [formatMs(v), name]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar
              {...anim}
              dataKey="p50"
              name="p50"
              fill={SERIES[0]}
              radius={[0, 4, 4, 0]}
              maxBarSize={10}
            />
            <Bar
              {...anim}
              dataKey="p95"
              name="p95"
              fill={SERIES[1]}
              radius={[0, 4, 4, 0]}
              maxBarSize={10}
            />
          </BarChart>
        </ChartFrame>
      </Panel>
    </div>
  )
}

export default UsageCharts
