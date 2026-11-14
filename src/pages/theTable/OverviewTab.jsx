import { useTranslation } from 'react-i18next'

import { getTableSummary } from '../../services/tableApi'
import StatTile from '../../components/admin/StatTile'
import RefreshButton from '../../components/admin/RefreshButton'
import { ApiError } from '../orbHunts/Modal'
import { Button } from '../orbHunts/ui'
import useOrbResource from '../orbHunts/useOrbResource'

/** Headline numbers from GET /backoffice/table/summary. */
const OverviewTab = ({ onOpenReports, onOpenPendingPhotos }) => {
  const { t } = useTranslation()
  const { data, error, loading, reload } = useOrbResource(
    signal => getTableSummary({ signal }),
    'summary'
  )
  const open = data?.openReports ?? null
  const pendingPhotos = data?.pendingPhotoChecks ?? null

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton
          onClick={reload}
          loading={loading}
          label={t('admin.theTable.common.refresh')}
        />
      </div>
      <ApiError error={error} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          className="col-span-2"
          size="lg"
          label={t('admin.theTable.overview.openReports')}
          value={open}
          loading={loading}
          tone={open ? 'bad' : 'ok'}
          hint={t('admin.theTable.overview.openReportsHint')}
        >
          {open ? (
            <Button
              size="sm"
              variant="danger"
              className="mt-3"
              onClick={onOpenReports}
            >
              {t('admin.theTable.overview.reviewNow')}
            </Button>
          ) : null}
        </StatTile>
        <StatTile
          label={t('admin.theTable.overview.hiddenAuto')}
          value={data?.hiddenAuto}
          loading={loading}
          tone={data?.hiddenAuto ? 'warn' : 'default'}
          hint={t('admin.theTable.overview.hiddenAutoHint')}
        />
        <StatTile
          label={t('admin.theTable.overview.pendingPhotoChecks')}
          value={pendingPhotos}
          loading={loading}
          tone={pendingPhotos ? 'warn' : 'default'}
          hint={t('admin.theTable.overview.pendingPhotoChecksHint')}
        >
          {pendingPhotos ? (
            <Button size="sm" className="mt-3" onClick={onOpenPendingPhotos}>
              {t('admin.theTable.overview.review')}
            </Button>
          ) : null}
        </StatTile>
        <StatTile
          label={t('admin.theTable.overview.posts24h')}
          value={data?.posts24h}
          loading={loading}
        />
        <StatTile
          label={t('admin.theTable.overview.activeUsers7d')}
          value={data?.activeUsers7d}
          loading={loading}
        />
        <StatTile
          className="col-span-2"
          label={t('admin.theTable.overview.friendships')}
          value={data?.friendships}
          loading={loading}
          hint={t('admin.theTable.overview.friendshipsHint')}
        />
      </div>
    </div>
  )
}

export default OverviewTab
