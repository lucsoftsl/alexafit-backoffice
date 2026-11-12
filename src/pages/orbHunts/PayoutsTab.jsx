import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

import { listPayouts } from '../../services/orbHuntApi'

import { csvFilename, downloadCsv, toCsv } from './csv'
import { ApiError } from './Modal'
import {
  WISH_STATUSES,
  WISH_STATUS_STYLE,
  WISH_TYPES,
  canRetryWish,
  formatDateTime
} from './model'
import { PayoutActionModal, revertSummary } from './PayoutActions'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Pagination,
  SuccessBanner,
  TableShell,
  Td,
  Th,
  inputClass
} from './ui'
import useOrbResource from './useOrbResource'

const PAGE_SIZE = 50
const EXPORT_SIZE = 5000

const show = value =>
  value === null || value === undefined
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)

/** Key-by-key before → after of the premium whitelist; changed keys highlighted. */
export const WhitelistDiff = ({ before, after }) => {
  const { t } = useTranslation()
  if (!before && !after) return <span className="text-slate-400">—</span>
  const keys = [
    ...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  ]
  return (
    <dl
      className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs"
      aria-label={t('admin.orbHunt.payouts.whitelistDiff')}
    >
      {keys.map(key => {
        const from = show(before?.[key])
        const to = show(after?.[key])
        const changed = from !== to
        return (
          <div key={key} className="contents">
            <dt className="font-mono text-slate-500">{key}</dt>
            <dd
              className={
                changed ? 'font-medium text-slate-900' : 'text-slate-500'
              }
            >
              {changed ? (
                <>
                  <span className="text-rose-700 line-through decoration-rose-300">
                    {from}
                  </span>
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only">
                    {' '}
                    {t('admin.orbHunt.payouts.changedTo')}{' '}
                  </span>
                  <span className="text-emerald-700">{to}</span>
                </>
              ) : (
                to
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

const CSV_COLUMNS = [
  'id',
  'userId',
  'email',
  'name',
  'optionId',
  'type',
  'amount',
  'status',
  'coinsApplied',
  'attempts',
  'error',
  'createdAt',
  'grantedAt',
  'revertedAt',
  'revertNote',
  'whitelistBefore',
  'whitelistAfter'
].map(key => ({ key, label: key }))

const PayoutsTab = ({ campaignId }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [params, setParams] = useState({ status: '', type: '', q: '', page: 1 })
  const [search, setSearch] = useState('')
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  const { data, error, loading, reload } = useOrbResource(
    signal =>
      listPayouts(campaignId, { ...params, pageSize: PAGE_SIZE }, { signal }),
    `${campaignId}:${JSON.stringify(params)}`
  )
  const set = patch =>
    setParams(prev => ({ ...prev, ...patch, page: patch.page || 1 }))

  const exportCsv = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const result = await listPayouts(campaignId, {
        ...params,
        page: 1,
        pageSize: EXPORT_SIZE,
        export: true
      })
      downloadCsv(
        csvFilename('orb-payouts', campaignId),
        toCsv(CSV_COLUMNS, result.rows || [])
      )
    } catch (err) {
      setExportError(err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
        <form
          role="search"
          onSubmit={e => {
            e.preventDefault()
            set({ q: search.trim() })
          }}
        >
          <Field label={t('admin.orbHunt.participants.search')}>
            <div className="relative">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('admin.orbHunt.participants.searchPlaceholder')}
                className={`${inputClass} pl-10`}
              />
            </div>
          </Field>
        </form>
        <Field label={t('admin.orbHunt.payouts.status')}>
          <select
            value={params.status}
            onChange={e => set({ status: e.target.value })}
            className={inputClass}
          >
            <option value="">{t('admin.orbHunt.payouts.anyStatus')}</option>
            {WISH_STATUSES.map(s => (
              <option key={s} value={s}>
                {t(`admin.orbHunt.wishStatus.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.orbHunt.payouts.type')}>
          <select
            value={params.type}
            onChange={e => set({ type: e.target.value })}
            className={inputClass}
          >
            <option value="">{t('admin.orbHunt.payouts.anyType')}</option>
            {WISH_TYPES.map(s => (
              <option key={s} value={s}>
                {t(`admin.orbHunt.wishTypes.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="secondary"
          loading={exporting}
          disabled={!data?.total}
          onClick={exportCsv}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {t('admin.orbHunt.common.exportCsv')}
        </Button>
      </div>

      {notice ? (
        <SuccessBanner onDismiss={() => setNotice(null)}>
          {notice}
        </SuccessBanner>
      ) : null}
      <ApiError error={exportError} />
      <ApiError error={error} />

      {data && !data.rows.length ? (
        <EmptyState
          title={t('admin.orbHunt.payouts.emptyTitle')}
          hint={t('admin.orbHunt.payouts.emptyHint')}
        />
      ) : (
        <div
          className={`af-fade ${loading && data ? 'opacity-60' : ''}`}
          aria-busy={loading}
        >
          <TableShell caption={t('admin.orbHunt.tabs.payouts')}>
            <thead>
              <tr>
                <Th>{t('admin.orbHunt.participants.user')}</Th>
                <Th>{t('admin.orbHunt.payouts.wish')}</Th>
                <Th>{t('admin.orbHunt.payouts.status')}</Th>
                <Th>{t('admin.orbHunt.payouts.whitelistDiff')}</Th>
                <Th>{t('admin.orbHunt.payouts.dates')}</Th>
                <Th className="text-right">
                  {t('admin.orbHunt.campaigns.actions')}
                </Th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map(row => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-slate-50"
                >
                  <Td>
                    <p className="font-medium text-slate-900">
                      {row.name || '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.email || row.userId}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="af-num font-semibold">{row.amount}</span>{' '}
                    {t(`admin.orbHunt.wishUnits.${row.type}`)}
                    <p className="font-mono text-[11px] text-slate-400">
                      {row.optionId}
                    </p>
                  </Td>
                  <Td>
                    <Badge className={WISH_STATUS_STYLE[row.status]}>
                      {t(`admin.orbHunt.wishStatus.${row.status}`)}
                    </Badge>
                    {row.error ? (
                      <p className="mt-1 max-w-xs text-xs text-rose-700">
                        {row.error}
                      </p>
                    ) : null}
                    {row.revertNote ? (
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        “{row.revertNote}”
                      </p>
                    ) : null}
                  </Td>
                  <Td>
                    {row.type === 'PREMIUM_DAYS' ? (
                      <WhitelistDiff
                        before={row.whitelistBefore}
                        after={row.whitelistAfter}
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-slate-600">
                    <p>
                      {t('admin.orbHunt.detail.wishCreated')}:{' '}
                      {formatDateTime(row.createdAt, lang)}
                    </p>
                    {row.grantedAt ? (
                      <p>
                        {t('admin.orbHunt.detail.wishGranted')}:{' '}
                        {formatDateTime(row.grantedAt, lang)}
                      </p>
                    ) : null}
                    {row.revertedAt ? (
                      <p>
                        {t('admin.orbHunt.detail.wishReverted')}:{' '}
                        {formatDateTime(row.revertedAt, lang)}
                      </p>
                    ) : null}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {canRetryWish(row) ? (
                        <Button
                          size="sm"
                          variant="warn"
                          onClick={() =>
                            setAction({ type: 'retry', wish: row })
                          }
                        >
                          {t('admin.orbHunt.payouts.retry')}
                        </Button>
                      ) : null}
                      {row.status === 'GRANTED' ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            setAction({ type: 'revert', wish: row })
                          }
                        >
                          {t('admin.orbHunt.payouts.revert')}
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          {data ? (
            <Pagination
              page={params.page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPage={page => set({ page })}
            />
          ) : null}
        </div>
      )}

      {action ? (
        <PayoutActionModal
          type={action.type}
          wish={action.wish}
          onClose={() => setAction(null)}
          onDone={result => {
            setNotice(
              action.type === 'revert'
                ? revertSummary(t, result)
                : t('admin.orbHunt.payouts.retried', {
                    status: t(`admin.orbHunt.wishStatus.${result?.status}`, {
                      defaultValue: result?.status
                    })
                  })
            )
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

export default PayoutsTab
