import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { getOverview } from '../../services/orbHuntApi'
import StatTile from '../../components/admin/StatTile'
import RefreshButton from '../../components/admin/RefreshButton'
import {
  SERIES,
  axisProps,
  gridProps,
  tooltipProps
} from '../../components/admin/chartTheme'
import { formatNumber, formatPercent } from '../../components/admin/format'

import { ApiError } from './Modal'
import { FLAGGED_REASONS } from './model'
import { Card, EmptyState } from './ui'
import useOrbResource from './useOrbResource'

const SOURCE_COLOR = {
  STEPS: SERIES[0],
  ACTIVE_DAYS: SERIES[2],
  STREAK: SERIES[1],
  EXPLORE: SERIES[6]
}

/** Sums attempts7d rows per reason (OK attempts grouped as "OK"). */
const attemptsByReason = rows =>
  Object.values(
    (rows || []).reduce((acc, row) => {
      const key = row.result === 'OK' ? 'OK' : row.reasonCode || 'REJECTED'
      const prev = acc[key] || { reason: key, count: 0 }
      return {
        ...acc,
        [key]: { ...prev, count: prev.count + Number(row.cnt || 0) }
      }
    }, {})
  ).sort((a, b) => b.count - a.count)

const ReasonBars = ({ rows }) => {
  const { t, i18n } = useTranslation()
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <ul className="space-y-2">
      {rows.map(row => {
        const flagged = FLAGGED_REASONS.has(row.reason)
        const ok = row.reason === 'OK'
        return (
          <li
            key={row.reason}
            className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm"
          >
            <span
              className={`truncate font-medium ${flagged ? 'text-amber-800' : 'text-slate-700'}`}
              title={row.reason}
            >
              {t(`admin.orbHunt.reasons.${row.reason}`, {
                defaultValue: row.reason
              })}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <span
                className={`af-bar-fill block h-full rounded-full ${
                  flagged
                    ? 'bg-amber-500'
                    : ok
                      ? 'bg-emerald-600'
                      : 'bg-slate-400'
                }`}
                style={{ transform: `scaleX(${row.count / max})` }}
              />
            </span>
            <span className="af-num w-14 text-right text-slate-600">
              {formatNumber(row.count, i18n.language)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const OverviewTab = ({ campaignId }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { data, error, loading, reload } = useOrbResource(
    signal => getOverview(campaignId, { signal }),
    campaignId
  )

  const wishes = data?.wishes
  const totalWishes = wishes ? wishes.coinWishes + wishes.premiumWishes : null
  const completionRate =
    data && data.participants ? data.completed / data.participants : null
  const reasons = attemptsByReason(data?.attempts7d)
  const perSlot = (data?.perSlot || []).map(s => ({
    ...s,
    label: `#${s.slot}`,
    typeLabel: t(`admin.orbHunt.sourceTypes.${s.sourceType}`)
  }))

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton
          onClick={reload}
          loading={loading}
          label={t('admin.orbHunt.common.refresh')}
        />
      </div>
      <ApiError error={error} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <StatTile
          className="col-span-2"
          size="lg"
          label={t('admin.orbHunt.overview.participants')}
          value={data?.participants}
          loading={loading}
          hint={t('admin.orbHunt.overview.blockedHint', {
            count: data?.blocked ?? 0
          })}
        />
        <StatTile
          label={t('admin.orbHunt.overview.active1d')}
          value={data?.active1d}
          loading={loading}
        />
        <StatTile
          label={t('admin.orbHunt.overview.active7d')}
          value={data?.active7d}
          loading={loading}
        />
        <StatTile
          label={t('admin.orbHunt.overview.completed')}
          value={data?.completed}
          loading={loading}
          tone="ok"
          hint={
            completionRate === null ? null : formatPercent(completionRate, lang)
          }
        />
        <StatTile
          label={t('admin.orbHunt.overview.wishes')}
          value={totalWishes}
          loading={loading}
          hint={
            wishes
              ? t('admin.orbHunt.overview.wishesHint', {
                  failed: wishes.failed,
                  reverted: wishes.reverted
                })
              : null
          }
          tone={wishes?.failed ? 'bad' : 'default'}
        />
        <StatTile
          label={t('admin.orbHunt.overview.coinsPaid')}
          value={wishes?.coinsPaid}
          loading={loading}
          hint={
            wishes
              ? t('admin.orbHunt.overview.coinWishes', {
                  count: wishes.coinWishes
                })
              : null
          }
        />
        <StatTile
          label={t('admin.orbHunt.overview.premiumDays')}
          value={wishes?.premiumDaysGranted}
          loading={loading}
          hint={
            wishes
              ? t('admin.orbHunt.overview.premiumWishes', {
                  count: wishes.premiumWishes
                })
              : null
          }
        />
        <StatTile
          className="col-span-2 md:col-span-1"
          label={t('admin.orbHunt.overview.openFlags')}
          value={data?.openFlags}
          loading={loading}
          tone={data?.openFlags ? 'warn' : 'default'}
        />
      </div>

      {data && !data.participants ? (
        <EmptyState
          title={t('admin.orbHunt.overview.emptyTitle')}
          hint={t('admin.orbHunt.overview.emptyHint')}
        />
      ) : null}

      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            eyebrow={t('admin.orbHunt.overview.funnelEyebrow')}
            title={t('admin.orbHunt.overview.funnel')}
          >
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart
                  data={data.funnel}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="filled" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip
                    {...tooltipProps}
                    labelFormatter={v =>
                      t('admin.orbHunt.overview.filledLabel', { count: v })
                    }
                    formatter={v => [
                      formatNumber(v, lang),
                      t('admin.orbHunt.overview.users')
                    ]}
                  />
                  <Bar dataKey="users" radius={[6, 6, 0, 0]}>
                    {data.funnel.map(row => (
                      <Cell
                        key={row.filled}
                        fill={
                          row.filled === data.funnel.length - 1
                            ? '#047857'
                            : '#6d28d9'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            eyebrow={t('admin.orbHunt.overview.slotsEyebrow')}
            title={t('admin.orbHunt.overview.perSlot')}
          >
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart
                  data={perSlot}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip
                    {...tooltipProps}
                    labelFormatter={(label, payload) =>
                      `${label} · ${payload?.[0]?.payload?.typeLabel || ''}`
                    }
                    formatter={v => [
                      formatNumber(v, lang),
                      t('admin.orbHunt.overview.collected')
                    ]}
                  />
                  <Bar dataKey="collected" radius={[6, 6, 0, 0]}>
                    {perSlot.map(row => (
                      <Cell
                        key={row.id}
                        fill={SOURCE_COLOR[row.sourceType] || SERIES[7]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
              {Object.entries(SOURCE_COLOR).map(([type, color]) => (
                <li key={type} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: color }}
                    aria-hidden="true"
                  />
                  {t(`admin.orbHunt.sourceTypes.${type}`)}
                </li>
              ))}
            </ul>
          </Card>

          <Card
            className="lg:col-span-2"
            eyebrow={t('admin.orbHunt.overview.dailyEyebrow')}
            title={t('admin.orbHunt.overview.daily')}
          >
            {data.daily.length ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart
                    data={data.daily}
                    margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="date" {...axisProps} minTickGap={24} />
                    <YAxis allowDecimals={false} {...axisProps} />
                    <Tooltip {...tooltipProps} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="orbs"
                      name={t('admin.orbHunt.overview.orbs')}
                      stroke={SERIES[6]}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="joins"
                      name={t('admin.orbHunt.overview.joins')}
                      stroke={SERIES[0]}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="wishes"
                      name={t('admin.orbHunt.overview.wishes')}
                      stroke={SERIES[2]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {t('admin.orbHunt.overview.noDaily')}
              </p>
            )}
          </Card>

          <Card
            eyebrow={t('admin.orbHunt.overview.attemptsEyebrow')}
            title={t('admin.orbHunt.overview.attempts')}
          >
            {reasons.length ? (
              <ReasonBars rows={reasons} />
            ) : (
              <p className="text-sm text-slate-500">
                {t('admin.orbHunt.overview.noAttempts')}
              </p>
            )}
          </Card>

          <Card
            eyebrow={t('admin.orbHunt.overview.orbsEyebrow')}
            title={t('admin.orbHunt.overview.orbKinds')}
          >
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['regularOrbs', 'text-slate-900'],
                ['superOrbs', 'text-violet-800'],
                ['pinOrbs', 'text-sky-800'],
                ['revokedOrbs', 'text-rose-700']
              ].map(([key, tone]) => (
                <div key={key} className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t(`admin.orbHunt.overview.${key}`)}
                  </dt>
                  <dd className={`af-num mt-1 text-2xl font-semibold ${tone}`}>
                    {formatNumber(data[key], lang)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

export default OverviewTab
