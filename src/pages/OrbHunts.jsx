import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { listCampaigns } from '../services/orbHuntApi'

import {
  CAMPAIGN_STATUS_STYLE,
  campaignTitle,
  formatDate
} from './orbHunts/model'
import { ApiError } from './orbHunts/Modal'
import { Badge, Tabs, inputClass } from './orbHunts/ui'
import useOrbResource from './orbHunts/useOrbResource'
import OverviewTab from './orbHunts/OverviewTab'
import CampaignsTab from './orbHunts/CampaignsTab'
import ParticipantsTab from './orbHunts/ParticipantsTab'
import PayoutsTab from './orbHunts/PayoutsTab'
import FraudTab from './orbHunts/FraudTab'
import AuditTab from './orbHunts/AuditTab'

// Leaflet is heavy; the map loads only when its tab opens.
const MapTab = lazy(() => import('./orbHunts/MapTab'))

const TAB_IDS = [
  'overview',
  'campaigns',
  'participants',
  'payouts',
  'map',
  'fraud',
  'audit'
]

/**
 * Orb Hunt admin console (ADMIN only). One campaign is selected at the top
 * (LIVE by default); every tab except Campaigns works on that campaign.
 */
const OrbHunts = () => {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState('overview')
  const [selectedId, setSelectedId] = useState(null)
  const campaigns = useOrbResource(signal => listCampaigns({ signal }), 'all')
  const list = useMemo(() => campaigns.data || [], [campaigns.data])

  // Default selection: the LIVE campaign, else the first one (LIVE first).
  useEffect(() => {
    if (!list.length) return
    if (selectedId && list.some(c => c.id === selectedId)) return
    const live = list.find(c => c.status === 'LIVE')
    setSelectedId((live || list[0]).id)
  }, [list, selectedId])

  const selected = list.find(c => c.id === selectedId) || null
  const lang = i18n.language

  const tabs = TAB_IDS.map(id => ({
    id,
    label: t(`admin.orbHunt.tabs.${id}`)
  }))

  const needsCampaign = tab !== 'campaigns'

  const renderTab = () => {
    if (tab === 'campaigns') {
      return (
        <CampaignsTab
          campaigns={list}
          loading={campaigns.loading}
          onChanged={campaigns.reload}
          onSelect={id => setSelectedId(id)}
          selectedId={selectedId}
        />
      )
    }
    if (!selected) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-800">
            {t('admin.orbHunt.page.noCampaign')}
          </p>
          <button
            type="button"
            onClick={() => setTab('campaigns')}
            className="af-focus mt-3 text-sm font-semibold text-violet-700 hover:underline"
          >
            {t('admin.orbHunt.page.goToCampaigns')}
          </button>
        </div>
      )
    }
    const props = { campaign: selected, campaignId: selected.id }
    switch (tab) {
      case 'participants':
        return <ParticipantsTab {...props} />
      case 'payouts':
        return <PayoutsTab {...props} />
      case 'map':
        return (
          <Suspense
            fallback={
              <div className="af-skeleton h-[520px] w-full rounded-3xl" />
            }
          >
            <MapTab {...props} />
          </Suspense>
        )
      case 'fraud':
        return <FraudTab {...props} />
      case 'audit':
        return <AuditTab {...props} />
      default:
        return <OverviewTab {...props} />
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
            {t('admin.orbHunt.page.eyebrow')}
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('admin.orbHunt.page.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {t('admin.orbHunt.page.subtitle')}
          </p>
        </div>

        {needsCampaign ? (
          <div className="flex min-w-[280px] flex-col gap-1">
            <label
              htmlFor="orb-campaign-picker"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {t('admin.orbHunt.page.campaign')}
            </label>
            <div className="flex items-center gap-2">
              <select
                id="orb-campaign-picker"
                value={selectedId || ''}
                onChange={e => setSelectedId(e.target.value)}
                disabled={!list.length}
                className={`${inputClass} min-w-[240px]`}
              >
                {list.map(c => (
                  <option key={c.id} value={c.id}>
                    {`${campaignTitle(c, lang)} · ${t(
                      `admin.orbHunt.status.${c.status}`
                    )} · ${formatDate(c.startsAt, lang)}`}
                  </option>
                ))}
              </select>
              {selected ? (
                <Badge className={CAMPAIGN_STATUS_STYLE[selected.status]}>
                  {t(`admin.orbHunt.status.${selected.status}`)}
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        label={t('admin.orbHunt.page.title')}
      />

      <ApiError error={campaigns.error} />

      {campaigns.loading && !campaigns.data ? (
        <div className="space-y-4" aria-busy="true">
          <div className="af-skeleton h-28 w-full rounded-3xl" />
          <div className="af-skeleton h-72 w-full rounded-3xl" />
        </div>
      ) : (
        <div
          key={`${tab}:${needsCampaign ? selectedId : ''}`}
          className="af-enter"
          role="tabpanel"
        >
          {renderTab()}
        </div>
      )}
    </div>
  )
}

export default OrbHunts
