import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { listAudit } from '../../services/orbHuntApi'

import { ApiError } from './Modal'
import { formatDateTime } from './model'
import {
  Button,
  EmptyState,
  Field,
  JsonBlock,
  Pagination,
  TableShell,
  Td,
  Th,
  inputClass
} from './ui'
import useOrbResource from './useOrbResource'

const PAGE_SIZE = 50

const AuditTab = ({ campaignId }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [page, setPage] = useState(1)
  const [userId, setUserId] = useState('')
  const [filter, setFilter] = useState('')

  const { data, error, loading } = useOrbResource(
    signal =>
      listAudit(
        campaignId,
        { page, pageSize: PAGE_SIZE, userId: filter || undefined },
        { signal }
      ),
    `${campaignId}:${page}:${filter}`
  )

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={e => {
          e.preventDefault()
          setFilter(userId.trim())
          setPage(1)
        }}
      >
        <Field
          label={t('admin.orbHunt.audit.userFilter')}
          hint={t('admin.orbHunt.audit.userFilterHint')}
        >
          <input
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className={`${inputClass} w-80 font-mono`}
          />
        </Field>
        <Button type="submit" variant="secondary" className="mb-5">
          {t('admin.orbHunt.audit.apply')}
        </Button>
        {filter ? (
          <Button
            variant="ghost"
            className="mb-5"
            onClick={() => {
              setUserId('')
              setFilter('')
              setPage(1)
            }}
          >
            {t('admin.orbHunt.common.reset')}
          </Button>
        ) : null}
      </form>

      <ApiError error={error} />

      {data && !data.rows.length ? (
        <EmptyState title={t('admin.orbHunt.audit.emptyTitle')} />
      ) : (
        <div
          className={`af-fade ${loading && data ? 'opacity-60' : ''}`}
          aria-busy={loading}
        >
          <TableShell caption={t('admin.orbHunt.tabs.audit')}>
            <thead>
              <tr>
                <Th>{t('admin.orbHunt.fraud.when')}</Th>
                <Th>{t('admin.orbHunt.audit.admin')}</Th>
                <Th>{t('admin.orbHunt.audit.action')}</Th>
                <Th>{t('admin.orbHunt.audit.target')}</Th>
                <Th>{t('admin.orbHunt.audit.note')}</Th>
                <Th>{t('admin.orbHunt.audit.change')}</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map(row => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-slate-50"
                >
                  <Td className="whitespace-nowrap text-xs text-slate-600">
                    {formatDateTime(row.createdAt, lang)}
                  </Td>
                  <Td>
                    <p className="text-sm text-slate-900">
                      {row.adminName || '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.adminEmail || row.adminUserId}
                    </p>
                  </Td>
                  <Td className="font-medium text-slate-900">
                    {t(`admin.orbHunt.auditActions.${row.action}`, {
                      defaultValue: row.action
                    })}
                  </Td>
                  <Td className="font-mono text-[11px] text-slate-500">
                    {row.targetUserId ? <p>{row.targetUserId}</p> : null}
                    {row.targetId ? <p>{row.targetId}</p> : null}
                    {!row.targetUserId && !row.targetId ? '—' : null}
                  </Td>
                  <Td className="max-w-xs text-sm text-slate-700">
                    {row.note || '—'}
                  </Td>
                  <Td>
                    <div className="space-y-1">
                      {row.before !== null && row.before !== undefined ? (
                        <JsonBlock
                          value={row.before}
                          label={t('admin.orbHunt.audit.before')}
                        />
                      ) : null}
                      {row.after !== null && row.after !== undefined ? (
                        <JsonBlock
                          value={row.after}
                          label={t('admin.orbHunt.audit.after')}
                        />
                      ) : null}
                      {row.before == null && row.after == null ? (
                        <span className="text-slate-400">—</span>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          {data ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPage={setPage}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

export default AuditTab
