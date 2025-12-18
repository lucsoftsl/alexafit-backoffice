import { useMemo, useEffect, useRef } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

const ProgressChart = ({ data = [], measurement = 'weight', unit = 'kg' }) => {
  const scrollRef = useRef(null)

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    const ordered = [...data].sort(
      (a, b) => new Date(a.checkInDateTime) - new Date(b.checkInDateTime)
    )

    return ordered
      .filter(item => item[measurement] != null && item[measurement] !== '')
      .map(item => {
        const date = new Date(item.checkInDateTime)
        const label = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })

        return {
          date: label,
          [measurement]: parseFloat(item[measurement]),
          fullDate: item.checkInDateTime
        }
      })
  }, [data, measurement])

  // Auto-scroll to the right (latest data) when chart renders/updates
  useEffect(() => {
    const el = scrollRef.current
    if (!el || chartData.length === 0) return

    const scrollToRight = () => {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    }

    // 1) next paint (layout available)
    requestAnimationFrame(scrollToRight)
    // 2) small fallback for ResponsiveContainer / font/layout settling
    const t = setTimeout(scrollToRight, 50)

    return () => clearTimeout(t)
  }, [chartData.length, measurement, unit])

  if (chartData.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl rounded-3xl border border-white/20">
        <p className="text-gray-500 text-center">No data available yet</p>
      </div>
    )
  }

  // Calculate minimum width based on data points for horizontal scrolling
  const minWidth = Math.max(600, chartData.length * 60)

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto">
      <div style={{ minWidth: `${minWidth}px` }}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6b46c1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6b46c1" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.3)"
              vertical={false}
            />

            <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />

            <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />

            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
              }}
              labelStyle={{ color: '#1f2937' }}
              formatter={value => [`${Number(value).toFixed(1)} ${unit}`, measurement]}
              labelFormatter={(label, payload) => {
                const p = payload && payload[0]
                const raw = p && p.payload && p.payload.fullDate
                const d = raw ? new Date(raw) : null
                return d
                  ? d.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : label
              }}
            />

            <Legend
              wrapperStyle={{
                paddingTop: '20px'
              }}
            />

            <Line
              type="monotone"
              dataKey={measurement}
              stroke="#6b46c1"
              strokeWidth={3}
              dot={{ fill: '#6b46c1', r: 5 }}
              activeDot={{ r: 7 }}
              fillOpacity={1}
              fill="url(#colorGradient)"
              name={`${measurement.charAt(0).toUpperCase() + measurement.slice(1)} (${unit})`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ProgressChart
