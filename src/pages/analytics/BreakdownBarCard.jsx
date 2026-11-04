import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import {
  axisProps,
  gridProps,
  tooltipProps
} from '../../components/admin/chartTheme'
import { chartAnimation } from '../../components/admin/motion'

/** One-series count breakdown (devices, sources, versions, endpoints). */
const BreakdownBarCard = ({
  title,
  unitLabel,
  rows,
  categoryKey,
  color,
  height = 'h-64',
  vertical = false,
  tickFormatter,
  labelFormatter
}) => {
  const { t } = useTranslation()
  const anim = useMemo(() => chartAnimation(), [])
  const seriesName = unitLabel || t('pages.analytics.breakdowns.events')
  return (
    <section className="af-lift min-w-0 rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {unitLabel ? (
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {unitLabel}
          </span>
        ) : null}
      </div>
      <div className={`${height} min-w-0`}>
        <ResponsiveContainer width="100%" height="100%">
          {vertical ? (
            <BarChart data={rows} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid {...gridProps} vertical horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis
                type="category"
                dataKey={categoryKey}
                width={220}
                {...axisProps}
                tickFormatter={tickFormatter}
              />
              <Tooltip
                {...tooltipProps}
                formatter={value => [value, seriesName]}
                labelFormatter={labelFormatter}
              />
              <Bar
                {...anim}
                dataKey="value"
                name={seriesName}
                fill={color}
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
              />
            </BarChart>
          ) : (
            <BarChart data={rows}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey={categoryKey}
                {...axisProps}
                tickFormatter={tickFormatter}
              />
              <YAxis allowDecimals={false} {...axisProps} width={40} />
              <Tooltip
                {...tooltipProps}
                formatter={value => [value, seriesName]}
                labelFormatter={labelFormatter}
              />
              <Bar
                {...anim}
                dataKey="value"
                name={seriesName}
                fill={color}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default BreakdownBarCard
