const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** 1536 → "1.5 KB" (binary units, like the Azure portal). */
export const formatBytes = (bytes, digits = 1) => {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  const value = n / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : value >= 100 ? 0 : digits)} ${UNITS[i]}`
}

export const formatNumber = (value, locale) =>
  Number.isFinite(Number(value))
    ? new Intl.NumberFormat(locale).format(Math.round(Number(value)))
    : '—'

export const formatCompact = (value, locale) =>
  Number.isFinite(Number(value))
    ? new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(Number(value))
    : '—'

/** Small dollar amounts keep cents-of-cents: $0.0042. */
export const formatUsd = (value, locale) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const digits = n !== 0 && Math.abs(n) < 1 ? 4 : 2
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits
  }).format(n)
}

export const formatPercent = (ratio, locale, digits = 1) =>
  Number.isFinite(Number(ratio))
    ? new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: digits
      }).format(Number(ratio))
    : '—'

export const formatMs = ms => {
  const n = Number(ms)
  if (!Number.isFinite(n)) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`
}

/** "just now", "3 min ago", "2 h ago" via Intl.RelativeTimeFormat. */
export const formatAgo = (date, now, locale) => {
  if (!date) return null
  const then = new Date(date).getTime()
  if (!Number.isFinite(then)) return null
  const seconds = Math.round((then - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 45) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86400), 'day')
}
