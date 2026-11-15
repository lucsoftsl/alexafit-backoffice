import { useEffect, useMemo, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { getUserCoinLedger, grantUserCoins } from '../services/loggedinApi'

const MAX_AMOUNT = 10000
const MAX_NOTE = 200
const QUICK_AMOUNTS = [10, 50, 100, -10]

const formatDate = value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

/**
 * Admin: give (or take away) Alexa Coins. Shows the current balance and the
 * latest coin history; every adjustment needs a note and is applied once.
 */
const GiveCoinsModal = ({ user, onClose }) => {
  const { t } = useTranslation()
  const k = 'common.giveCoins'
  const [ledger, setLedger] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  // One id per form submission: a double click or retry pays once.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const load = useMemo(
    () => () =>
      getUserCoinLedger(user.userId)
        .then(data => {
          setLedger(data)
          setLoadError(null)
        })
        .catch(err => setLoadError(err.message)),
    [user.userId]
  )

  useEffect(() => {
    load()
  }, [load])

  const parsed = Number(amount)
  const amountValid = Number.isInteger(parsed) && parsed !== 0 && Math.abs(parsed) <= MAX_AMOUNT
  const noteValid = note.trim().length > 0 && note.trim().length <= MAX_NOTE
  const takesTooMuch = ledger && parsed < 0 && ledger.balance + parsed < 0

  const submit = async () => {
    if (!amountValid || !noteValid || saving) return
    setSaving(true)
    setError(null)
    try {
      const result = await grantUserCoins({
        userId: user.userId,
        amount: parsed,
        note: note.trim(),
        requestId
      })
      setDone(result)
      setAmount('')
      setNote('')
      setRequestId(crypto.randomUUID())
      load()
    } catch (err) {
      setError(err.code === 'INSUFFICIENT_FUNDS' ? t(`${k}.insufficient`) : err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="give-coins-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id="give-coins-title" className="text-lg font-semibold text-slate-900">
              🪙 {t(`${k}.title`)}
            </h2>
            <p className="text-sm text-slate-500">
              {user.name} · {user.email}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label={t('common.close')}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl bg-amber-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">{t(`${k}.balance`)}</p>
            <p className="text-2xl font-semibold text-amber-900">
              {ledger ? ledger.balance : loadError ? '—' : '…'}
            </p>
            {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
          </div>

          <div>
            <label htmlFor="give-coins-amount" className="text-sm font-medium text-slate-700">
              {t(`${k}.amount`)}
            </label>
            <input
              id="give-coins-amount"
              type="number"
              step="1"
              min={-MAX_AMOUNT}
              max={MAX_AMOUNT}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              placeholder="50"
            />
            <div className="mt-2 flex gap-2">
              {QUICK_AMOUNTS.map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {value > 0 ? `+${value}` : value}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">{t(`${k}.amountHelp`, { max: MAX_AMOUNT })}</p>
          </div>

          <div>
            <label htmlFor="give-coins-note" className="text-sm font-medium text-slate-700">
              {t(`${k}.note`)}
            </label>
            <input
              id="give-coins-note"
              type="text"
              maxLength={MAX_NOTE}
              value={note}
              onChange={e => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              placeholder={t(`${k}.notePlaceholder`)}
            />
          </div>

          {takesTooMuch ? <p className="text-sm text-red-600">{t(`${k}.insufficient`)}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {done ? (
            <p className="text-sm text-emerald-700">
              {done.duplicate
                ? t(`${k}.duplicate`)
                : t(`${k}.done`, { amount: done.applied > 0 ? `+${done.applied}` : done.applied, balance: done.balance })}
            </p>
          ) : null}

          {ledger?.items?.length ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(`${k}.recent`)}</p>
              <ul className="mt-1 divide-y divide-slate-100 text-sm">
                {ledger.items.map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate text-slate-600">
                      {item.reason}
                      {item.meta?.note ? ` · ${item.meta.note}` : ''}
                      <span className="block text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                    </span>
                    <span className={`shrink-0 font-medium ${item.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {item.amount > 0 ? `+${item.amount}` : item.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            {t('common.close')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!amountValid || !noteValid || saving || takesTooMuch}
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {saving
              ? t(`${k}.saving`)
              : parsed < 0
                ? t(`${k}.take`, { n: Math.abs(parsed) || '' })
                : t(`${k}.give`, { n: amountValid ? parsed : '' })}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GiveCoinsModal
