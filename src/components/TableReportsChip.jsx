import { useTranslation } from 'react-i18next'
import { FlagIcon } from '@heroicons/react/24/outline'

/**
 * Header pill with the open The Table reports (Apple expects them handled
 * within 24 h). Hidden when there is nothing open or the count is unknown.
 */
const TableReportsChip = ({ count, onClick, compact = false }) => {
  const { t } = useTranslation()
  if (!count) return null
  const label = t('admin.theTable.badge.openReports', { count })
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="af-focus af-press inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-rose-900/20 transition-colors hover:bg-rose-700"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <FlagIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="af-num">{compact ? count : label}</span>
    </button>
  )
}

export default TableReportsChip
