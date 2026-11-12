import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'

import { prettyJson } from './model'

const BUTTON_VARIANTS = {
  primary:
    'bg-violet-700 text-white hover:bg-violet-800 shadow-sm shadow-violet-900/10',
  danger: 'bg-rose-700 text-white hover:bg-rose-800 shadow-sm',
  warn: 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
  secondary:
    'border border-slate-300 bg-white text-slate-800 hover:border-violet-400 hover:text-violet-800',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`af-focus af-press inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'
    } ${BUTTON_VARIANTS[variant]} ${className}`}
    {...rest}
  >
    {loading ? (
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        aria-hidden="true"
      />
    ) : null}
    {children}
  </button>
)

export const Badge = ({ className = '', children, title }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}
  >
    {children}
  </span>
)

export const ErrorBanner = ({ children }) => (
  <div
    role="alert"
    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
  >
    {children}
  </div>
)

export const SuccessBanner = ({ children, onDismiss }) => {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      <span>{children}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="af-focus text-xs font-semibold underline-offset-2 hover:underline"
        >
          {t('admin.orbHunt.common.dismiss')}
        </button>
      ) : null}
    </div>
  )
}

export const EmptyState = ({ title, hint }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
    <p className="font-medium text-slate-700">{title}</p>
    {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
  </div>
)

export const Card = ({ title, eyebrow, actions, children, className = '' }) => (
  <section
    className={`min-w-0 rounded-3xl border border-slate-200 bg-white p-5 ${className}`}
  >
    {title || actions ? (
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          ) : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </header>
    ) : null}
    {children}
  </section>
)

export const Pagination = ({ page, pageSize, total, onPage }) => {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize))
  return (
    <nav
      aria-label={t('admin.orbHunt.common.pagination')}
      className="flex items-center justify-between gap-3 pt-3 text-sm text-slate-600"
    >
      <span className="af-num">
        {t('admin.orbHunt.common.pageOf', { page, pages, total: total || 0 })}
      </span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('admin.orbHunt.common.previous')}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={t('admin.orbHunt.common.next')}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  )
}

/** Collapsible pretty-printed JSON (coordinates are stripped). */
export const JsonBlock = ({ value, label }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (value === null || value === undefined) {
    return <span className="text-slate-400">—</span>
  }
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="af-focus inline-flex items-center gap-1 rounded-md text-xs font-medium text-violet-700 hover:text-violet-900"
      >
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
        />
        {label || t('admin.orbHunt.common.details')}
      </button>
      {open ? (
        <pre className="mt-1 max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
          {prettyJson(value)}
        </pre>
      ) : null}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-slate-50 disabled:text-slate-500'

export const Field = ({ label, hint, children, className = '' }) => (
  <label className={`block min-w-0 ${className}`}>
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <div className="mt-1">{children}</div>
    {hint ? (
      <span className="mt-1 block text-xs text-slate-500">{hint}</span>
    ) : null}
  </label>
)

/**
 * Number input that keeps its text while typing; `onChange(number|null)`.
 * Shows "min–max" under the field when `bounds` is given.
 */
export const NumberField = ({
  label,
  value,
  onChange,
  bounds,
  step = 1,
  disabled,
  optional = false
}) => {
  const { t } = useTranslation()
  const outOfRange =
    bounds &&
    value !== null &&
    value !== undefined &&
    (value < bounds[0] || value > bounds[1])
  return (
    <Field
      label={label}
      hint={
        bounds
          ? `${t('admin.orbHunt.common.range', { min: bounds[0], max: bounds[1] })}${
              optional ? ` · ${t('admin.orbHunt.common.optional')}` : ''
            }`
          : null
      }
    >
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        min={bounds?.[0]}
        max={bounds?.[1]}
        step={step}
        disabled={disabled}
        aria-invalid={outOfRange || undefined}
        onChange={e =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
        className={`${inputClass} af-num ${outOfRange ? 'border-rose-400 ring-2 ring-rose-100' : ''}`}
      />
    </Field>
  )
}

export const Toggle = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={Boolean(checked)}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`af-focus relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
      checked ? 'bg-violet-700' : 'bg-slate-300'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
)

/** Segmented tab bar (WAI-ARIA tabs with arrow-key navigation). */
export const Tabs = ({ tabs, active, onChange, label, size = 'md' }) => {
  const onKeyDown = event => {
    const index = tabs.findIndex(tab => tab.id === active)
    const delta =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = tabs[(index + delta + tabs.length) % tabs.length]
    onChange(next.id)
    event.currentTarget.querySelector(`[data-tab="${next.id}"]`)?.focus()
  }
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1"
    >
      {tabs.map(tab => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab={tab.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`af-focus inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium transition-colors ${
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
            } ${
              selected
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span
                className={`af-num rounded-full px-1.5 text-[10px] font-bold ${
                  selected
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export const TableShell = ({ children, caption }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
    <table className="min-w-full text-sm">
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      {children}
    </table>
  </div>
)

export const Th = ({ children, className = '' }) => (
  <th
    scope="col"
    className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
  >
    {children}
  </th>
)

export const Td = ({ children, className = '', ...rest }) => (
  <td
    {...rest}
    className={`border-b border-slate-100 px-3 py-2 align-top text-slate-800 ${className}`}
  >
    {children}
  </td>
)
