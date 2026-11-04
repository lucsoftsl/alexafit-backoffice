import { useState } from 'react'

const STORAGE_PREFIX = 'alexafit.admin.open.'

const readOpen = id => {
  try {
    const value = window.localStorage.getItem(STORAGE_PREFIX + id)
    return value === null ? null : value === '1'
  } catch {
    return null
  }
}

const writeOpen = (id, open) => {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, open ? '1' : '0')
  } catch {
    // Private mode or blocked storage: it just won't be remembered.
  }
}

/**
 * A section that folds away under its title. Built on <details>, so the
 * keyboard (Enter/Space on the title) and screen readers work as is; whether
 * it is open is remembered per browser under `alexafit.admin.open.<id>` (a
 * convenience only). Children render only while open, so collapsed charts
 * and long tables cost nothing.
 *
 * @param {{ id: string, title: string, meta?: import('react').ReactNode,
 *   hint?: string, defaultOpen?: boolean, className?: string,
 *   children: import('react').ReactNode }} props
 */
const CollapsibleSection = ({
  id,
  title,
  meta,
  hint,
  defaultOpen = true,
  className = '',
  children
}) => {
  const [open, setOpen] = useState(() => readOpen(id) ?? defaultOpen)
  const headingId = `section-${id}-title`

  return (
    <details
      open={open}
      onToggle={event => {
        const next = event.currentTarget.open
        if (next === open) return
        setOpen(next)
        writeOpen(id, next)
      }}
      className={`group min-w-0 ${className}`}
    >
      <summary className="af-focus flex cursor-pointer list-none items-center gap-3 rounded-xl py-1 select-none [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-transform duration-[160ms] ease-out group-open:rotate-90 group-hover:text-violet-700 motion-reduce:transition-none"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3">
            <path
              d="M4.5 2.5 8 6l-3.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2
          id={headingId}
          className="text-lg font-semibold text-slate-900 group-hover:text-violet-800"
        >
          {title}
        </h2>
        {meta ? (
          <span className="af-num rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {meta}
          </span>
        ) : null}
      </summary>
      {open ? (
        <div
          className="af-enter pt-3"
          role="region"
          aria-labelledby={headingId}
        >
          {hint ? <p className="mb-3 text-sm text-slate-500">{hint}</p> : null}
          {children}
        </div>
      ) : null}
    </details>
  )
}

export default CollapsibleSection
