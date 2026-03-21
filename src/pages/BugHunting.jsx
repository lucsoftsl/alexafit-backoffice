import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BugAntIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'
import { getAllBugs, updateBugStatus } from '../services/api'

const STATUS_CONFIG = {
  PENDING:  { label: 'Pending',  color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
  ACCEPTED: { label: 'Accepted', color: 'bg-green-100 text-green-800',  dot: 'bg-green-400' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800',    dot: 'bg-red-400' },
  CLAIMED:  { label: 'Claimed',  color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-400' },
}

const STATUSES = ['ALL', 'PENDING', 'ACCEPTED', 'REJECTED', 'CLAIMED']

const BUG_BOUNTY_RATES = {
  FUNCTIONAL_BUG:  0.50,
  VISUAL_BUG:      0.10,
  CRASH_BUG:       0.75,
  PERFORMANCE_BUG: 0.25,
  SECURITY_BUG:    1.00,
  DATA_BUG:        0.15,
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}

const formatCurrency = (value, currency) => {
  if (value == null || value === 0) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value)
  } catch {
    return `${currency || 'USD'} ${Number(value).toFixed(2)}`
  }
}

const BugDetailModal = ({ bug, onClose, onUpdate }) => {
  const { t } = useTranslation()
  const [newStatus, setNewStatus] = useState(bug.bugStatus)
  const [newBugType, setNewBugType] = useState(bug.bugType || '')
  const [newValue, setNewValue] = useState(String(bug.potentialPaymentValue || ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await updateBugStatus({
        bugId: bug.id,
        bugStatus: newStatus,
        bugType: newBugType || null,
        potentialPaymentValue: newValue ? parseFloat(newValue) : undefined,
      })
      onUpdate()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-purple-600 px-6 py-4 flex items-center gap-3">
          <BugAntIcon className="w-6 h-6 text-white" />
          <h2 className="text-lg font-bold text-white">{t('Bug Report Detail')}</h2>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Bug Info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Bug Title')}</p>
            <p className="text-gray-900 font-medium">{bug.bugTitle}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('User ID')}</p>
            <p className="text-gray-700 text-sm font-mono break-all">{bug.userId}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Bug Type')}</p>
            <p className="text-gray-700 text-sm">{bug.bugType || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Reproduction Steps')}</p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">{bug.bugDescription}</div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Submitted')}</p>
            <p className="text-gray-700 text-sm">{formatDate(bug.dateTimeCreated)}</p>
          </div>
          {bug.screenshotUrl && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Screenshot')}</p>
              <a href={bug.screenshotUrl} target="_blank" rel="noreferrer">
                <img src={bug.screenshotUrl} alt="Bug screenshot" className="rounded-lg max-h-48 object-contain border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity" />
              </a>
            </div>
          )}

          {/* Editable fields */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Bug Type')}</label>
              <select
                value={newBugType}
                onChange={(e) => {
                  const type = e.target.value
                  setNewBugType(type)
                  if (BUG_BOUNTY_RATES[type] !== undefined) {
                    setNewValue(String(BUG_BOUNTY_RATES[type]))
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">— None (let admin decide) —</option>
                <option value="FUNCTIONAL_BUG">🐛  Functional Bug</option>
                <option value="VISUAL_BUG">👁  Visual Bug</option>
                <option value="CRASH_BUG">💥  Crash Bug</option>
                <option value="PERFORMANCE_BUG">⚡  Performance Bug</option>
                <option value="SECURITY_BUG">🛡  Security Bug</option>
                <option value="DATA_BUG">📊  Data / Content Bug</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('Status')}</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {['PENDING', 'ACCEPTED', 'REJECTED', 'CLAIMED'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                {t('Payout Value')} <span className="text-gray-400 normal-case font-normal">(USD)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {bug.potentialPaymentCurrency && bug.potentialPaymentCurrency !== 'USD' && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠ User requests payout in <strong>{bug.potentialPaymentCurrency}</strong> — convert before transferring.
                </p>
              )}
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? t('Saving...') : t('Save Changes')}
          </button>
        </div>
      </div>
    </div>
  )
}

const BugHunting = () => {
  const { t } = useTranslation()
  const [bugs, setBugs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedBug, setSelectedBug] = useState(null)
  const hasLoadedRef = useRef(false)

  const fetchBugs = async (searchVal = search, statusVal = statusFilter) => {
    setLoading(true)
    try {
      const result = await getAllBugs({
        search: searchVal || undefined,
        status: statusVal !== 'ALL' ? statusVal : undefined,
        limit: 200,
        offset: 0,
      })
      setBugs(result.bugs || [])
      setTotal(result.total || 0)
    } catch (err) {
      console.error('Failed to fetch bugs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      fetchBugs()
    }
  }, [])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchBugs(search, statusFilter)
  }

  const handleStatusFilter = (status) => {
    setStatusFilter(status)
    fetchBugs(search, status)
  }

  // Summary stats
  const stats = {
    total: bugs.length,
    pending: bugs.filter(b => b.bugStatus === 'PENDING').length,
    accepted: bugs.filter(b => b.bugStatus === 'ACCEPTED').length,
    rejected: bugs.filter(b => b.bugStatus === 'REJECTED').length,
    claimed: bugs.filter(b => b.bugStatus === 'CLAIMED').length,
    totalPayout: bugs
      .filter(b => b.bugStatus === 'ACCEPTED' || b.bugStatus === 'CLAIMED')
      .reduce((sum, b) => sum + (parseFloat(b.potentialPaymentValue) || 0), 0),
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <BugAntIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('Bug Hunting')}</h1>
            <p className="text-sm text-gray-500">{t('Review and manage user-submitted bug reports')}</p>
          </div>
        </div>
        <button
          onClick={() => fetchBugs()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <ArrowPathIcon className="w-4 h-4" />
          {t('Refresh')}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('Total'), value: stats.total, icon: BugAntIcon, color: 'text-gray-700' },
          { label: t('Pending'), value: stats.pending, icon: ClockIcon, color: 'text-yellow-600' },
          { label: t('Accepted'), value: stats.accepted, icon: CheckCircleIcon, color: 'text-green-600' },
          { label: t('Rejected'), value: stats.rejected, icon: XCircleIcon, color: 'text-red-600' },
          { label: t('Claimed'), value: stats.claimed, icon: CurrencyDollarIcon, color: 'text-purple-600' },
          { label: t('Total Payout'), value: `$${stats.totalPayout.toFixed(2)}`, icon: CurrencyDollarIcon, color: 'text-purple-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search by title or user ID...')}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              {t('Search')}
            </button>
          </form>
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map(status => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t(status === 'ALL' ? 'All' : status)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bugs table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : bugs.length === 0 ? (
          <div className="text-center py-16">
            <BugAntIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('No bug reports found')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('Bug reports submitted by users will appear here')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Bug Title')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('User ID')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Type')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Status')}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Payout')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Submitted')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Media')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bugs.map((bug) => {
                    const statusConf = STATUS_CONFIG[bug.bugStatus] || STATUS_CONFIG.PENDING
                    return (
                      <tr key={bug.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 max-w-[200px] truncate">{bug.bugTitle}</p>
                          <p className="text-xs text-gray-400 max-w-[200px] truncate mt-0.5">{bug.bugDescription}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{bug.userId?.slice(0, 12)}...</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600">{bug.bugType || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusConf.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-gray-800">
                            {formatCurrency(bug.potentialPaymentValue, 'USD')}
                          </span>
                          {bug.potentialPaymentCurrency && bug.potentialPaymentCurrency !== 'USD' && (
                            <span className="text-xs text-gray-400 ml-1 block">
                              requests {bug.potentialPaymentCurrency}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">{formatDate(bug.dateTimeCreated)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {bug.screenshotUrl ? (
                            <a href={bug.screenshotUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center">
                              <PhotoIcon className="w-5 h-5 text-blue-500 hover:text-blue-700 transition-colors" />
                            </a>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedBug(bug)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            {t('Review')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
              {t('Showing')} {bugs.length} {t('of')} {total} {t('bug reports')}
            </div>
          </>
        )}
      </div>

      {selectedBug && (
        <BugDetailModal
          bug={selectedBug}
          onClose={() => setSelectedBug(null)}
          onUpdate={() => fetchBugs()}
        />
      )}
    </div>
  )
}

export default BugHunting
