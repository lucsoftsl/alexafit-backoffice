import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { listReports } from '../../services/tableApi'
import RefreshButton from '../../components/admin/RefreshButton'
import { Tabs } from '../orbHunts/ui'

import ListStates from './ListStates'
import ReportCard from './ReportCard'
import useCursorList from './useCursorList'
import { REPORT_STATUSES } from './model'

/** Moderation queue, newest first, filtered by report status. */
const ReportsTab = ({ onFilterUser }) => {
  const { t } = useTranslation()
  const [status, setStatus] = useState('OPEN')
  const list = useCursorList(async (cursor, signal) => {
    const data = await listReports({ status, cursor }, { signal })
    return { items: data?.reports || [], nextCursor: data?.nextCursor }
  }, status)

  const filters = REPORT_STATUSES.map(id => ({
    id,
    label: t(`admin.theTable.reportStatus.${id}`)
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={filters}
          active={status}
          onChange={setStatus}
          label={t('admin.theTable.reports.filterLabel')}
          size="sm"
        />
        <RefreshButton
          onClick={list.reload}
          loading={list.loading}
          label={t('admin.theTable.common.refresh')}
        />
      </div>
      {status === 'OPEN' ? (
        <p className="text-xs text-slate-500">
          {t('admin.theTable.reports.slaHint')}
        </p>
      ) : null}
      <ListStates
        list={list}
        emptyTitle={t(`admin.theTable.reports.empty.${status}`)}
        emptyHint={
          status === 'OPEN' ? t('admin.theTable.reports.emptyOpenHint') : null
        }
      >
        {list.items.map(report => (
          <ReportCard
            key={report.id}
            report={report}
            isOpen={status === 'OPEN'}
            onDone={list.reload}
            onFilterUser={onFilterUser}
          />
        ))}
      </ListStates>
    </div>
  )
}

export default ReportsTab
