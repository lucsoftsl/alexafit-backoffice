import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BoltIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  UsersIcon
} from '@heroicons/react/24/outline'

import DatabaseSizeCard from '../../components/admin/DatabaseSizeCard'
import Panel from '../../components/admin/Panel'
import StatTile from '../../components/admin/StatTile'
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatUsd
} from '../../components/admin/format'
import useAdminResource from '../../components/admin/useAdminResource'
import {
  getAdminOverview,
  getAiUsage,
  getAzureDbSize,
  getTidbDbSize
} from '../../services/adminApi'

const DAY_MS = 86_400_000

const DeltaChip = ({ label, value, locale }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
    <span aria-hidden>+</span>
    <span className="af-num font-semibold">{formatNumber(value, locale)}</span>
    <span className="text-emerald-700/80">{label}</span>
  </span>
)

/** DAU / WAU / MAU as three bars on one scale (MAU = full width). */
const ActiveUsersPanel = ({ resource, onRefresh }) => {
  const { t, i18n } = useTranslation()
  const active = resource.data?.activeUsers
  const rows = [
    {
      key: 'today',
      label: t('admin.overview.activeToday'),
      value: active?.today
    },
    { key: 'd7', label: t('admin.overview.active7d'), value: active?.d7 },
    { key: 'd30', label: t('admin.overview.active30d'), value: active?.d30 }
  ]
  const max = Math.max(1, active?.d30 || 0)
  const stickiness = active?.d30 ? (active.today || 0) / active.d30 : null
  return (
    <Panel
      eyebrow={t('admin.overview.engagement')}
      title={t('admin.overview.activeUsers')}
      subtitle={t('admin.overview.activeUsersHint')}
      onRefresh={onRefresh}
      refreshing={resource.refreshing}
      refreshLabel={t('admin.common.refresh')}
      className="af-lift lg:col-span-4"
    >
      <ul className="space-y-3">
        {rows.map(row => (
          <li key={row.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-600">{row.label}</span>
              <span className="af-num font-semibold text-slate-900">
                {row.value === null || row.value === undefined
                  ? '—'
                  : formatNumber(row.value, i18n.language)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="af-bar-fill h-full w-full rounded-full bg-violet-600"
                style={{ transform: `scaleX(${(row.value || 0) / max})` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        {t('admin.overview.stickiness', {
          value: formatPercent(stickiness, i18n.language)
        })}
      </p>
    </Panel>
  )
}

/**
 * "Where we stand": users, engagement, subscribers, AI spend and database
 * sizes. Each card refreshes on its own; `refreshSignal` re-measures all.
 */
const StandingOverview = ({ refreshSignal, onAiNavigate }) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  const overview = useAdminResource(getAdminOverview, { signal: refreshSignal })
  const azure = useAdminResource(getAzureDbSize, { signal: refreshSignal })
  const tidb = useAdminResource(getTidbDbSize, { signal: refreshSignal })
  const usageFetcher = useMemo(
    () => () =>
      getAiUsage({
        from: new Date(Date.now() - 30 * DAY_MS).toISOString(),
        to: new Date().toISOString()
      }),
    []
  )
  const usage = useAdminResource(usageFetcher, { signal: refreshSignal })

  const users = overview.data?.users
  const aiTotals = usage.data?.totals

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <StatTile
          className="lg:col-span-5"
          size="lg"
          label={t('admin.overview.totalUsers')}
          value={users?.total ?? null}
          loading={overview.loading || overview.refreshing}
          icon={UsersIcon}
        >
          <div className="mt-4 flex flex-wrap gap-2">
            {users ? (
              <>
                <DeltaChip
                  label={t('admin.overview.last7d')}
                  value={users.signups7d}
                  locale={locale}
                />
                <DeltaChip
                  label={t('admin.overview.last30d')}
                  value={users.signups30d}
                  locale={locale}
                />
              </>
            ) : null}
            {overview.error ? (
              <span className="text-xs text-rose-700">
                {t('admin.overview.loadFailed')}
              </span>
            ) : null}
          </div>
        </StatTile>

        <ActiveUsersPanel
          resource={overview}
          onRefresh={() => overview.reload(true)}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
          <StatTile
            label={t('admin.overview.programSubscribers')}
            value={overview.data?.programSubscribers ?? null}
            loading={overview.loading}
            icon={UserGroupIcon}
            hint={t('admin.overview.programSubscribersHint')}
          />
          <button
            type="button"
            onClick={onAiNavigate}
            className="af-focus group rounded-3xl text-left"
          >
            <StatTile
              label={t('admin.overview.aiSpend30d')}
              value={aiTotals ? aiTotals.costUsd : null}
              format={v => formatUsd(v, locale)}
              loading={usage.loading}
              icon={CurrencyDollarIcon}
              hint={
                usage.error
                  ? t('admin.overview.aiUnavailable')
                  : t('admin.overview.aiCalls', {
                      count: aiTotals?.calls || 0,
                      calls: formatCompact(aiTotals?.calls || 0, locale)
                    })
              }
            >
              <span className="af-underline mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                <BoltIcon className="h-3.5 w-3.5" aria-hidden />
                {t('admin.overview.openAi')}
              </span>
            </StatTile>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DatabaseSizeCard
          title={t('admin.db.azureTitle')}
          engineLabel="Azure SQL"
          accent="var(--af-azure)"
          resource={azure}
        />
        <DatabaseSizeCard
          title={t('admin.db.tidbTitle')}
          engineLabel="TiDB"
          accent="var(--af-tidb)"
          resource={tidb}
        />
      </div>
    </div>
  )
}

export default StandingOverview
