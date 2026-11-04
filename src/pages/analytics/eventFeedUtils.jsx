/** Pure helpers and constants for the analytics event stream (EventFeed). */

export const TIME_RANGE_OPTIONS = [
  { value: '15m', label: 'Last 15 minutes' },
  { value: '30m', label: 'Last 30 minutes' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '3h', label: 'Last 3 hours' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '12h', label: 'Last 12 hours' },
  { value: '1d', label: 'Last 24 hours' },
  { value: '2d', label: 'Last 2 days' },
  { value: '7d', label: 'Last 7 days' }
]

export const ANALYTICS_KIND_COLORS = {
  TOTAL: '#111827',
  API_FAILURE: '#ef4444',
  APP_FAILURE: '#f97316',
  UI_INTERACTION: '#7c3aed',
  PRODUCT_ANALYTICS: '#2563eb',
  API_EVENT: '#0f766e',
  OTHER: '#64748b'
}

export const ANALYTICS_SERIES_KEYS = Object.keys(ANALYTICS_KIND_COLORS)

export const getBucketMinutes = lookbackWindow => {
  switch (lookbackWindow) {
    case '15m':
    case '30m':
    case '1h':
      return 1
    case '3h':
    case '6h':
      return 5
    case '12h':
      return 15
    case '1d':
    case '2d':
      return 30
    case '7d':
      return 120
    default:
      return 5
  }
}

export const truncateToBucket = (dateValue, bucketMinutes) => {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const bucketMs = bucketMinutes * 60 * 1000
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs)
}

export const formatBucketLabel = (dateValue, lookbackWindow) => {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  if (
    lookbackWindow === '7d' ||
    lookbackWindow === '2d' ||
    lookbackWindow === '1d'
  ) {
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatDateTime = value => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString()
}

export const safePrettyJson = value => {
  if (!value) {
    return 'N/A'
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const truncateLabel = (value, maxLength = 32) => {
  const label = String(value || '')
  if (label.length <= maxLength) {
    return label
  }

  return `${label.slice(0, maxLength - 1)}…`
}

export const formatEndpointLabel = value => {
  const endpoint = String(value || '').trim()
  if (!endpoint) {
    return 'N/A'
  }

  if (endpoint.startsWith('firebase://') || endpoint.startsWith('storage://')) {
    return endpoint
  }

  try {
    if (/^https?:\/\//i.test(endpoint)) {
      const parsed = new URL(endpoint)
      return `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`
    }
  } catch {}

  return endpoint
}

export const parseAnalyticsUserIdentifier = value => {
  const raw = String(value || '').trim()
  const [userIdRaw, ...deviceIdParts] = raw.split('|')
  const normalizedUserId =
    userIdRaw && userIdRaw !== 'undefined' ? userIdRaw : 'N/A'
  const normalizedDeviceId = deviceIdParts.join('|').trim() || 'N/A'

  return {
    raw,
    userId: normalizedUserId,
    deviceId: normalizedDeviceId
  }
}

export const buildCountRows = (counts = {}, labelKey = 'label') =>
  Object.entries(counts)
    .map(([label, value]) => ({
      [labelKey]: label,
      value
    }))
    .sort((a, b) => b.value - a.value)

export const getRangeLabel = (rangeValue, t) =>
  t(`pages.analytics.filters.rangeLabels.${rangeValue}`, {
    defaultValue:
      TIME_RANGE_OPTIONS.find(option => option.value === rangeValue)?.label ||
      rangeValue
  })

export const renderTimelineTooltip = (tooltipProps, lookbackWindow) => {
  const { active, label, payload } = tooltipProps || {}

  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null
  }

  const uniqueEntries = payload.reduce((acc, entry) => {
    const key = entry?.dataKey || entry?.name
    if (!key || acc.some(item => item.key === key)) {
      return acc
    }

    acc.push({
      key,
      color: entry?.color || ANALYTICS_KIND_COLORS[key] || '#64748b',
      value: entry?.value ?? 0
    })
    return acc
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-slate-900">
        {formatBucketLabel(label, lookbackWindow)}
      </p>
      <div className="mt-2 space-y-1.5">
        {uniqueEntries.map(entry => (
          <div
            key={entry.key}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.key}
            </span>
            <span className="font-semibold text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
