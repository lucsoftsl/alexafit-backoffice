import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import RefreshButton from '../components/admin/RefreshButton'
import UpdatedAgo from '../components/admin/UpdatedAgo'
import { selectIsAdmin } from '../store/userSlice'

import EventFeed from './analytics/EventFeed'
import StandingOverview from './analytics/StandingOverview'

/**
 * Admin › Analytics: "where we stand" (users, engagement, AI spend, database
 * sizes) above the event stream. The global refresh re-measures every card.
 */
const Analytics = ({ onNavigate }) => {
  const { t } = useTranslation()
  const isAdmin = useSelector(selectIsAdmin)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [refreshedAt, setRefreshedAt] = useState(() => new Date().toISOString())
  const [refreshing, setRefreshing] = useState(false)

  if (!isAdmin) return null

  const refreshAll = () => {
    setRefreshing(true)
    setRefreshSignal(n => n + 1)
    setRefreshedAt(new Date().toISOString())
    // The cards show their own progress; the global spinner is a short ack.
    window.setTimeout(() => setRefreshing(false), 600)
  }

  return (
    <div className="af-enter space-y-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-600">
            {t('admin.overview.eyebrow')}
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">
            {t('admin.overview.title')}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            {t('admin.overview.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <UpdatedAgo at={refreshedAt} />
          <RefreshButton
            onClick={refreshAll}
            loading={refreshing}
            label={t('admin.common.refreshAll')}
          />
        </div>
      </header>

      <StandingOverview
        refreshSignal={refreshSignal}
        onAiNavigate={() => onNavigate?.('ai')}
      />

      <div className="border-t border-slate-200 pt-8">
        <EventFeed refreshSignal={refreshSignal} />
      </div>
    </div>
  )
}

export default Analytics
