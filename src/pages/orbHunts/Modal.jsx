import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { XMarkIcon } from '@heroicons/react/24/outline'

import { NOTE_MAX, NOTE_MIN, errorDetails, errorMessage } from './model'
import { Button, ErrorBanner } from './ui'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps Tab inside `ref`, closes on Escape, focuses the first field (or the
 * container) on open and gives focus back to the opener on close.
 */
export const useFocusTrap = (ref, onClose) => {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const node = ref.current
    const previous = document.activeElement
    const first =
      node?.querySelector('[data-autofocus]') ||
      node?.querySelector(FOCUSABLE) ||
      node
    first?.focus()
    const onKey = event => {
      // A nested dialog (modal inside the drawer) handles its own keys.
      if (event.target.closest?.('[role="dialog"]') !== node) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll(FOCUSABLE)].filter(
        el => el.offsetParent !== null || el === document.activeElement
      )
      if (!items.length) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    node?.addEventListener('keydown', onKey)
    return () => {
      node?.removeEventListener('keydown', onKey)
      if (previous instanceof window.HTMLElement) previous.focus()
    }
  }, [ref])
}

/** Centered dialog. `size`: 'md' | 'lg'. */
export const Modal = ({ title, onClose, children, footer, size = 'md' }) => {
  const { t } = useTranslation()
  const ref = useRef(null)
  const titleId = useId()
  useFocusTrap(ref, onClose)
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center p-4 sm:items-center">
      <div
        className="af-backdrop absolute inset-0 bg-slate-900/45"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`af-enter relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none ${
          size === 'lg' ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.orbHunt.common.close')}
            className="af-focus af-press rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}

/** Shows an API error with its validation messages (if any). */
export const ApiError = ({ error }) => {
  const { t } = useTranslation()
  if (!error) return null
  const details = errorDetails(error)
  return (
    <ErrorBanner>
      <p>{errorMessage(t, error)}</p>
      {details.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
          {details.map(message => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </ErrorBanner>
  )
}

/**
 * Confirm dialog. With `requireNote`, the confirm button stays disabled until
 * the note has NOTE_MIN..NOTE_MAX characters. `onConfirm(note)` may throw;
 * the error is shown in the dialog and the dialog stays open.
 */
export const ConfirmModal = ({
  title,
  message,
  confirmLabel,
  tone = 'primary',
  requireNote = false,
  optionalNote = false,
  children,
  onConfirm,
  onClose
}) => {
  const { t } = useTranslation()
  const noteId = useId()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const trimmed = note.trim()
  const noteValid =
    !requireNote || (trimmed.length >= NOTE_MIN && trimmed.length <= NOTE_MAX)
  const showNote = requireNote || optionalNote

  const submit = async event => {
    event.preventDefault()
    if (!noteValid || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(trimmed)
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('admin.orbHunt.common.cancel')}
          </Button>
          <Button
            type="submit"
            form={noteId}
            variant={tone}
            disabled={!noteValid}
            loading={busy}
          >
            {confirmLabel || t('admin.orbHunt.common.confirm')}
          </Button>
        </>
      }
    >
      <form id={noteId} onSubmit={submit} className="space-y-4">
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        {children}
        {showNote ? (
          <label className="block">
            <span className="text-sm font-medium text-slate-800">
              {requireNote
                ? t('admin.orbHunt.common.noteRequired')
                : t('admin.orbHunt.common.noteOptional')}
            </span>
            <textarea
              data-autofocus
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={NOTE_MAX}
              rows={3}
              aria-invalid={requireNote && !noteValid && note.length > 0}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <span className="mt-1 flex justify-between text-xs text-slate-500">
              <span>
                {requireNote
                  ? t('admin.orbHunt.common.noteHint', { min: NOTE_MIN })
                  : ''}
              </span>
              <span className="af-num">
                {note.length}/{NOTE_MAX}
              </span>
            </span>
          </label>
        ) : null}
        <ApiError error={error} />
      </form>
    </Modal>
  )
}

/** Right-side drawer (participant detail). */
export const Drawer = ({ title, subtitle, onClose, children }) => {
  const { t } = useTranslation()
  const ref = useRef(null)
  const titleId = useId()
  useFocusTrap(ref, onClose)
  return (
    <div className="fixed inset-0 z-[1100] flex justify-end">
      <div
        className="af-backdrop absolute inset-0 bg-slate-900/35"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="af-drawer relative flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-lg font-semibold text-slate-900"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.orbHunt.common.close')}
            className="af-focus af-press rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  )
}
