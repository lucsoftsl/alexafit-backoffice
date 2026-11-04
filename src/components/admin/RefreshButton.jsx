import { ArrowPathIcon } from '@heroicons/react/24/outline'

/** Icon (or icon + label) button that spins while `loading`. */
const RefreshButton = ({
  onClick,
  loading = false,
  label,
  compact = false
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    aria-label={label}
    title={label}
    aria-busy={loading}
    className={`af-press af-focus inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white font-medium text-slate-600 hover:border-violet-300 hover:text-violet-700 disabled:cursor-wait disabled:opacity-70 ${
      compact ? 'h-8 w-8' : 'h-9 px-4 text-sm'
    }`}
  >
    <ArrowPathIcon
      className={`h-4 w-4 ${loading ? 'animate-spin text-violet-600' : ''}`}
    />
    {compact ? null : <span>{label}</span>}
  </button>
)

export default RefreshButton
