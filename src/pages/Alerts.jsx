import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import useAdminResource from '../components/admin/useAdminResource'
import { getAbuseAlerts } from '../services/adminApi'

import AlertDetail from './alerts/AlertDetail'
import RulesEditor from './alerts/RulesEditor'
import TidbInsights from './alerts/TidbInsights'

const PAGE_SIZE = 30

export default function Alerts() {
  const { t, i18n } = useTranslation()
  const [filters, setFilters] = useState({
    status: 'open',
    severity: '',
    rule: '',
    userId: '',
    offset: 0
  })
  const [userFilter, setUserFilter] = useState('')
  useEffect(() => {
    if (userFilter === filters.userId) return
    const timer = window.setTimeout(() => {
      setFilters(prev => ({ ...prev, userId: userFilter, offset: 0 }))
      setRevision(prev => prev + 1)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [userFilter, filters.userId])
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('alerts')
  const resource = useAdminResource(
    () => getAbuseAlerts({ ...filters, limit: PAGE_SIZE }),
    { signal: revision }
  )
  const filter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: key === 'offset' ? value : 0
    }))
    setRevision(prev => prev + 1)
  }
  const rows = resource.data?.alerts || []
  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t('admin.alerts.title')}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('admin.alerts.subtitle')}
          </p>
        </div>
        <button
          onClick={() => resource.reload()}
          disabled={resource.loading || resource.refreshing}
          className="rounded-xl border bg-white px-4 py-2 text-sm"
        >
          {t('admin.alerts.refresh')}
        </button>
      </div>
      <nav className="flex gap-2" aria-label={t('admin.alerts.title')}>
        {['alerts', 'rules', 'insights'].map(id => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm ${tab === id ? 'bg-slate-900 text-white' : 'bg-white'}`}
          >
            {t(`admin.alerts.${id}`)}
          </button>
        ))}
      </nav>
      {tab === 'rules' ? (
        <RulesEditor />
      ) : tab === 'insights' ? (
        <TidbInsights />
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap gap-3">
            {['status', 'severity'].map(key => (
              <label key={key} className="text-xs text-slate-500">
                {t(`admin.alerts.${key}`)}
                <select
                  value={filters[key]}
                  onChange={e => filter(key, e.target.value)}
                  className="mt-1 block rounded-lg border p-2 text-sm text-slate-900"
                >
                  {[
                    '',
                    ...(key === 'status'
                      ? ['open', 'acknowledged', 'resolved']
                      : ['warning', 'critical'])
                  ].map(value => (
                    <option key={value} value={value}>
                      {t(`admin.alerts.${value || 'all'}`)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="text-xs text-slate-500">
              {t('admin.alerts.rule')}
              <select
                value={filters.rule}
                onChange={e => filter('rule', e.target.value)}
                className="mt-1 block rounded-lg border p-2 text-sm text-slate-900"
              >
                <option value="">{t('admin.alerts.all')}</option>
                {[
                  'ai_overuse',
                  'ai_cost_spike',
                  'limit_hammering',
                  'duplicate_requests',
                  'api_rate_limit',
                  'multi_account_device',
                  'coin_farming',
                  'azure_sql_storage',
                  'tidb_ingest_flood'
                ].map(rule => (
                  <option key={rule} value={rule}>
                    {t(`admin.alerts.ruleNames.${rule}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              {t('admin.alerts.user')}
              <input
                value={userFilter}
                maxLength={128}
                onChange={e => setUserFilter(e.target.value)}
                className="mt-1 block rounded-lg border p-2 text-sm text-slate-900"
              />
            </label>
          </div>
          {resource.error && (
            <p role="alert" className="py-4 text-rose-700">
              {t('admin.alerts.loadFailed')}
            </p>
          )}
          {resource.data?.tableAvailable === false && (
            <p role="status" className="py-4 text-amber-700">
              {t('admin.alerts.tableMissing')}
            </p>
          )}
          {resource.loading ? (
            <p>{t('admin.alerts.loading')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    {[
                      'rule',
                      'severity',
                      'status',
                      'user',
                      'occurrences',
                      'updated'
                    ].map(key => (
                      <th key={key} className="p-3">
                        {t(`admin.alerts.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(alert => (
                    <tr key={alert.id}>
                      <td className="p-3">
                        <button
                          onClick={() => setSelected(alert)}
                          className="text-left font-medium text-violet-700 underline-offset-4 hover:underline"
                        >
                          {t(`admin.alerts.ruleNames.${alert.rule}`, {
                            defaultValue: alert.rule
                          })}
                        </button>
                      </td>
                      <td
                        className={`p-3 ${alert.severity === 'critical' ? 'text-rose-700' : 'text-amber-700'}`}
                      >
                        {t(`admin.alerts.${alert.severity}`)}
                      </td>
                      <td className="p-3">
                        {t(`admin.alerts.${alert.status}`)}
                      </td>
                      <td className="max-w-48 truncate p-3 font-mono text-xs">
                        {alert.userId || '—'}
                      </td>
                      <td className="p-3">{alert.occurrences}</td>
                      <td className="whitespace-nowrap p-3 text-xs">
                        {new Date(alert.updatedAt).toLocaleString(
                          i18n.language
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="py-10 text-center text-slate-500">
                  {t('admin.alerts.empty')}
                </p>
              )}
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-4 text-sm">
            <button
              disabled={!filters.offset}
              onClick={() =>
                filter('offset', Math.max(0, filters.offset - PAGE_SIZE))
              }
            >
              {t('admin.alerts.previous')}
            </button>
            <span>
              {filters.offset + (rows.length ? 1 : 0)}–
              {filters.offset + rows.length} / {resource.data?.total ?? 0}
            </span>
            <button
              disabled={
                filters.offset + PAGE_SIZE >= (resource.data?.total || 0)
              }
              onClick={() => filter('offset', filters.offset + PAGE_SIZE)}
            >
              {t('admin.alerts.next')}
            </button>
          </div>
        </section>
      )}
      {selected && (
        <AlertDetail
          key={selected.id}
          alert={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null)
            resource.reload()
          }}
        />
      )}
    </div>
  )
}
