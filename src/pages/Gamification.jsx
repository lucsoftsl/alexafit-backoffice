import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowPathIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

import { auth } from '../config/firebase'
import { API_BASE_FOODSYNC_URL } from '../services/const'

/**
 * Admin gamification tools:
 *  - coin ledger lookup per user (userId or email)
 *  - read-only view of quest / badge / league / shop configuration
 *  - shortcut to voucher fulfilment (Users page → rewards)
 *
 * Register in App.jsx as activePage 'gamification' (ADMIN only) and pass
 * `onOpenPurchases={() => setActivePage('users')}`.
 */

const PAGE_SIZE = 50

async function adminGet(path, params = {}) {
  const token = await auth.currentUser?.getIdToken()
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString()
  const res = await fetch(`${API_BASE_FOODSYNC_URL}${path}${query ? `?${query}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `HTTP ${res.status}`)
  }
  return body.data
}

const formatDateTime = value => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

function SimpleTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            {columns.map(c => (
              <th key={c.key} className="px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className="border-b border-gray-100 last:border-0">
              {columns.map(c => (
                <td key={c.key} className="px-3 py-2 text-gray-800">
                  {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LedgerLookup() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(
    async before => {
      const q = query.trim()
      if (!q) return
      setLoading(true)
      setError(null)
      try {
        const data = await adminGet('/backoffice/gamification/ledger', {
          [q.includes('@') ? 'email' : 'userId']: q,
          limit: PAGE_SIZE,
          before
        })
        setResult(data)
        setItems(prev => (before ? [...prev, ...data.items] : data.items))
      } catch (e) {
        setError(e.message)
        if (!before) {
          setResult(null)
          setItems([])
        }
      } finally {
        setLoading(false)
      }
    },
    [query]
  )

  return (
    <Section title={t('Coin ledger', 'Coin ledger')}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={e => {
          e.preventDefault()
          load(null)
        }}
      >
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('User ID or email', 'User ID or email')}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {t('Search', 'Search')}
        </button>
      </form>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t('Balance', 'Balance')} value={result.balance} />
          <Stat label={t('Level', 'Level')} value={result.level?.level} />
          <Stat label="XP" value={result.level?.xp} />
          <Stat label={t('User ID', 'User ID')} value={result.userId} small />
        </div>
      ) : null}

      {items.length ? (
        <SimpleTable
          columns={[
            { key: 'createdAt', label: t('Date', 'Date'), render: r => formatDateTime(r.createdAt) },
            { key: 'reason', label: t('Reason', 'Reason') },
            { key: 'refId', label: 'Ref' },
            {
              key: 'amount',
              label: t('Amount', 'Amount'),
              render: r => (
                <span className={r.amount > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-gray-700'}>
                  {r.amount > 0 ? `+${r.amount}` : r.amount}
                </span>
              )
            },
            { key: 'balanceAfter', label: t('Balance after', 'Balance after') }
          ]}
          rows={items}
        />
      ) : result && !loading ? (
        <p className="text-sm text-gray-500">{t('No ledger entries', 'No ledger entries')}</p>
      ) : null}

      {result?.nextCursor ? (
        <button
          onClick={() => load(result.nextCursor)}
          disabled={loading}
          className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
        >
          {t('Load more', 'Load more')}
        </button>
      ) : null}
    </Section>
  )
}

function Stat({ label, value, small = false }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`${small ? 'truncate text-xs' : 'text-xl'} font-semibold text-gray-900`}>
        {value ?? '—'}
      </div>
    </div>
  )
}

function ConfigView() {
  const { t } = useTranslation()
  const [config, setConfig] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setConfig(await adminGet('/backoffice/gamification/config'))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Section title={t('Gamification configuration', 'Gamification configuration')}>
      <button
        onClick={load}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {t('Refresh', 'Refresh')}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {config ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('Daily activity cap', 'Daily activity cap')} value={config.caps.dailyActivity} />
            <Stat label={t('Daily total cap', 'Daily total cap')} value={config.caps.dailyTotal} />
            <Stat label={t('Streak freeze', 'Streak freeze')} value={config.shop.streakFreeze} />
            <Stat label={t('Avatar unlock', 'Avatar unlock')} value={config.shop.avatarUnlock} />
          </div>
          <h3 className="font-medium text-gray-800">
            {t('Daily quests', 'Daily quests')} ({config.questsPerDay}/day, +{config.questsAllBonus} bonus)
          </h3>
          <SimpleTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'target', label: t('Target', 'Target') },
              { key: 'unit', label: t('Unit', 'Unit') },
              { key: 'coins', label: t('Coins', 'Coins') }
            ]}
            rows={config.quests}
          />
          <h3 className="font-medium text-gray-800">{t('Badges', 'Badges')}</h3>
          <SimpleTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'kind', label: t('Kind', 'Kind') },
              { key: 'threshold', label: t('Threshold', 'Threshold') },
              { key: 'coins', label: t('Coins', 'Coins') }
            ]}
            rows={config.badges}
          />
          <h3 className="font-medium text-gray-800">{t('Weekly challenges', 'Weekly challenges')}</h3>
          <SimpleTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'target', label: t('Target', 'Target') },
              { key: 'coins', label: t('Coins', 'Coins') }
            ]}
            rows={config.weeklyChallenges}
          />
          <h3 className="font-medium text-gray-800">{t('Vouchers', 'Vouchers')}</h3>
          <SimpleTable
            columns={[
              { key: 'value', label: '€', render: r => `€${r.value}` },
              { key: 'title', label: t('Title', 'Title'), render: r => r.title.replace('{{amount}}', `€${r.value}`) },
              { key: 'coins', label: t('Coins', 'Coins') }
            ]}
            rows={config.shop.vouchers}
          />
          <p className="text-sm text-gray-600">
            {t('Leagues', 'Leagues')}: {config.leagues.tiers.map(x => x.id).join(' → ')} · {t('group size', 'group size')}{' '}
            {config.leagues.groupSize} · ↑{config.leagues.promote} ↓{config.leagues.demote} · {t('podium', 'podium')}{' '}
            {config.leagues.podiumRewards.join('/')}
          </p>
        </div>
      ) : null}
    </Section>
  )
}

export default function Gamification({ onOpenPurchases }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Gamification', 'Gamification')}</h1>
          <p className="text-sm text-gray-500">
            {t('Coin ledger, quests, badges and leagues', 'Coin ledger, quests, badges and leagues')}
          </p>
        </div>
        {onOpenPurchases ? (
          <button
            onClick={onOpenPurchases}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            {t('Voucher fulfilment', 'Voucher fulfilment')} →
          </button>
        ) : null}
      </header>
      <LedgerLookup />
      <ConfigView />
    </div>
  )
}
