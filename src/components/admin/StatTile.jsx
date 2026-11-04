import { formatNumber } from './format'
import { useCountUp } from './motion'
import Skeleton from './Skeleton'

/**
 * A headline number. Numbers count up when they change; `format` turns the
 * animated value into text (defaults to a grouped integer).
 */
const StatTile = ({
  label,
  value,
  format,
  hint,
  tone = 'default',
  size = 'md',
  loading = false,
  icon: Icon,
  children,
  className = ''
}) => {
  const animated = useCountUp(typeof value === 'number' ? value : null)
  const text =
    value === null || value === undefined
      ? '—'
      : format
        ? format(animated)
        : formatNumber(animated)
  const toneClass =
    tone === 'bad'
      ? 'text-rose-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'ok'
          ? 'text-emerald-700'
          : 'text-slate-900'
  return (
    <div
      className={`af-lift rounded-3xl border border-slate-200 bg-white p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        {Icon ? <Icon className="h-5 w-5 text-slate-400" aria-hidden /> : null}
      </div>
      {loading && (value === null || value === undefined) ? (
        <Skeleton
          className={size === 'lg' ? 'mt-3 h-12 w-2/3' : 'mt-3 h-8 w-1/2'}
        />
      ) : (
        <p
          className={`af-num af-fade mt-2 font-semibold ${toneClass} ${
            size === 'lg' ? 'text-5xl' : 'text-3xl'
          } ${loading ? 'opacity-60' : 'opacity-100'}`}
          aria-live="polite"
        >
          {text}
        </p>
      )}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {children}
    </div>
  )
}

export default StatTile
