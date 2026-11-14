import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs } from './orbHunts/ui'
import { DEFAULT_TAB, TAB_IDS } from './theTable/model'
import OverviewTab from './theTable/OverviewTab'
import ReportsTab from './theTable/ReportsTab'
import PostsTab from './theTable/PostsTab'
import CuratedTab from './theTable/CuratedTab'

/**
 * The Table admin console (ADMIN only): moderation queue, post browser and
 * curated posts. `openReports` comes from the app-wide poll (nav badge).
 */
const TheTable = ({ openReports = null }) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState(DEFAULT_TAB)
  const [postsUserId, setPostsUserId] = useState('')
  const [photoPending, setPhotoPending] = useState(false)

  const openPosts = ({ userId = '', pendingPhotos = false } = {}) => {
    setPostsUserId(userId)
    setPhotoPending(pendingPhotos)
    setTab('posts')
  }

  const tabs = TAB_IDS.map(id => ({
    id,
    label: t(`admin.theTable.tabs.${id}`),
    badge: id === 'reports' && openReports ? openReports : null
  }))

  const renderTab = () => {
    switch (tab) {
      case 'overview':
        return (
          <OverviewTab
            onOpenReports={() => setTab('reports')}
            onOpenPendingPhotos={() => openPosts({ pendingPhotos: true })}
          />
        )
      case 'posts':
        return (
          <PostsTab
            userId={postsUserId}
            onUserIdChange={setPostsUserId}
            initialPhotoPending={photoPending}
          />
        )
      case 'curated':
        return <CuratedTab />
      default:
        return <ReportsTab onFilterUser={userId => openPosts({ userId })} />
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
          {t('admin.theTable.page.eyebrow')}
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">
          {t('admin.theTable.page.title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {t('admin.theTable.page.subtitle')}
        </p>
      </header>

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        label={t('admin.theTable.page.title')}
      />

      <div key={tab} className="af-enter" role="tabpanel">
        {renderTab()}
      </div>
    </div>
  )
}

export default TheTable
