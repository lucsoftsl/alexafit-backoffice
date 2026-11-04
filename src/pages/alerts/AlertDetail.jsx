import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import AiUserDrawer from '../ai/AiUserDrawer'
import { updateAbuseAlert } from '../../services/adminApi'

import { alertDetails } from './model'

function AlertActions({ alert, onUpdated }) {
  const { t } = useTranslation()
  const details = alertDetails(alert.detailsJson)
  const [note, setNote] = useState('')
  const [hours, setHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const run = async (operation, action) => {
    setBusy(true)
    setError(false)
    try {
      await updateAbuseAlert(alert.id, operation, {
        note,
        ...(action ? { action, hours } : {})
      })
      onUpdated()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">
        {t(`admin.alerts.ruleNames.${alert.rule}`, {
          defaultValue: alert.rule
        })}
      </h2>
      <p>
        {t(`admin.alerts.${alert.severity}`)} ·{' '}
        {t(`admin.alerts.${alert.status}`)} · {t('admin.alerts.occurrences')}:{' '}
        {alert.occurrences}
      </p>
      {details.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {details.map(([key, value]) => (
            <div key={key}>
              <dt className="text-slate-500">
                {t(`admin.alerts.detailFields.${key}`)}
              </dt>
              <dd className="break-words font-medium">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {alert.note && (
        <p className="whitespace-pre-wrap text-sm text-slate-600">
          {alert.note}
        </p>
      )}
      {alert.subjectHash && (
        <p className="break-all font-mono text-xs text-slate-500">
          {alert.subjectHash}
        </p>
      )}
      <label className="block text-sm">
        {t('admin.alerts.note')}
        <textarea
          maxLength={1000}
          value={note}
          onChange={e => setNote(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 p-2"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {['acknowledge', 'resolve'].map(operation => (
          <button
            key={operation}
            disabled={busy || !note.trim()}
            onClick={() => run(operation)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
          >
            {t(`admin.alerts.${operation}`)}
          </button>
        ))}
      </div>
      {alert.userId && (
        <>
          <label className="block text-sm">
            {t('admin.alerts.hours')}
            <input
              type="number"
              min={1}
              max={168}
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              className="ml-2 w-20 rounded-lg border p-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {['liftAutoLimit', 'makePermanent', 'blockAi', 'extend'].map(
              action => (
                <button
                  key={action}
                  disabled={
                    busy ||
                    !note.trim() ||
                    !Number.isInteger(hours) ||
                    hours < 1 ||
                    hours > 168
                  }
                  onClick={() => run('actions', action)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
                >
                  {t(`admin.alerts.${action}`)}
                </button>
              )
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {t('admin.alerts.saveFailed')}
        </p>
      )}
    </section>
  )
}

function SubjectDrawer({ children, onClose }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.focus()
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div
        aria-hidden
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('admin.alerts.detail')}
        className="relative h-full w-full max-w-xl overflow-auto bg-slate-50 p-6 shadow-2xl"
      >
        <button
          ref={ref}
          onClick={onClose}
          className="mb-4 rounded-lg border bg-white px-3 py-2"
        >
          {t('admin.alerts.close')}
        </button>
        {children}
      </aside>
    </div>,
    document.body
  )
}

export default function AlertDetail({ alert, onClose, onUpdated }) {
  const content = <AlertActions alert={alert} onUpdated={onUpdated} />
  return alert.userId ? (
    <AiUserDrawer userId={alert.userId} onClose={onClose}>
      {content}
    </AiUserDrawer>
  ) : (
    <SubjectDrawer onClose={onClose}>{content}</SubjectDrawer>
  )
}
