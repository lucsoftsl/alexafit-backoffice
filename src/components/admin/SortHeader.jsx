import { ChevronUpIcon } from '@heroicons/react/20/solid'

/** A column heading that sorts its table when clicked (see ./sortable.js). */
const SortHeader = ({ column, sort, align = 'left', children }) => {
  const active = sort.key === column
  return (
    <th
      scope="col"
      aria-sort={
        active
          ? sort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
      className={`py-2 pr-4 ${align === 'right' ? 'text-right' : ''}`}
    >
      <button
        type="button"
        onClick={() => sort.toggle(column)}
        className={`af-focus inline-flex items-center gap-1 rounded uppercase tracking-[0.14em] transition-colors ${
          active ? 'text-slate-700' : 'hover:text-slate-700'
        }`}
      >
        {children}
        <ChevronUpIcon
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform duration-[160ms] ease-out motion-reduce:transition-none ${
            active ? 'opacity-100' : 'opacity-30'
          } ${active && sort.direction === 'desc' ? 'rotate-180' : ''}`}
        />
      </button>
    </th>
  )
}

export default SortHeader
