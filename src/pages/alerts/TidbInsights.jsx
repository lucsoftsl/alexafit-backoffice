import { useTranslation } from 'react-i18next'

import useAdminResource from '../../components/admin/useAdminResource'
import { getAnalyticsInsights } from '../../services/adminApi'

export default function TidbInsights() {
  const { t } = useTranslation()
  const resource = useAdminResource(getAnalyticsInsights)
  const data = resource.data
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('admin.alerts.insights')}</h2>
        <button
          onClick={() => resource.reload()}
          disabled={resource.loading || resource.refreshing}
          className="text-sm font-semibold text-violet-700"
        >
          {t('admin.alerts.refresh')}
        </button>
      </div>
      {resource.error ? (
        <p role="alert" className="text-rose-700">
          {t('admin.alerts.loadFailed')}
        </p>
      ) : !data ? (
        <p>{t('admin.alerts.loading')}</p>
      ) : (
        <div className="space-y-4 text-sm">
          <p>{t('admin.alerts.insightsRange', { hours: data.hours })}</p>
          {data.truncated && (
            <p role="status" className="text-amber-700">
              {t('admin.alerts.sampleLimited', { count: data.sampleLimit })}
            </p>
          )}
          <div className="flex flex-wrap gap-6">
            <p>
              {t('admin.alerts.events')}:{' '}
              <strong>{data.totals?.events ?? 0}</strong>
            </p>
            <p>
              {t('admin.alerts.users')}:{' '}
              <strong>{data.totals?.users ?? 0}</strong>
            </p>
          </div>
          <h3 className="font-semibold">{t('admin.alerts.byAction')}</h3>
          <ul className="divide-y divide-slate-100">
            {data.byAction?.map(row => (
              <li key={row.action} className="flex justify-between py-2">
                <span>{row.action}</span>
                <span>{row.events}</span>
              </li>
            ))}
          </ul>
          <h3 className="font-semibold">{t('admin.alerts.topUsers')}</h3>
          <ul className="divide-y divide-slate-100">
            {data.topUsers?.map(row => (
              <li
                key={row.userHash}
                className="flex gap-4 justify-between py-2"
              >
                <span
                  className="truncate font-mono text-xs"
                  title={row.userHash}
                >
                  {row.userHash}
                </span>
                <span>{row.events}</span>
              </li>
            ))}
          </ul>
          <h3 className="font-semibold">{t('admin.alerts.guardTitle')}</h3>
          <p className="text-slate-500">{t('admin.alerts.guardScope')}</p>
          <dl className="grid grid-cols-2 gap-3">
            {['accepted', 'quota', 'sampled', 'payload'].map(key => (
              <div key={key}>
                <dt className="text-slate-500">
                  {t(`admin.alerts.guardCounts.${key}`)}
                </dt>
                <dd className="font-semibold">{data.guard?.[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <p className="text-slate-500">{t('admin.alerts.retentionOff')}</p>
        </div>
      )}
    </section>
  )
}
