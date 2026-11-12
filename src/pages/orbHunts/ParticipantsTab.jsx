import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

import { listParticipants } from '../../services/orbHuntApi'

import { csvFilename, downloadCsv, toCsv } from './csv'
import { ApiError } from './Modal'
import { FLAG_STYLE, WISH_STATUS_STYLE, formatDateTime } from './model'
import ParticipantDetail from './ParticipantDetail'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Pagination,
  TableShell,
  Td,
  Th,
  inputClass
} from './ui'
import useOrbResource from './useOrbResource'

const PAGE_SIZE = 50
const EXPORT_SIZE = 5000
const FILTERS = [
  'all',
  'completed',
  'wished',
  'wishFailed',
  'readyNoWish',
  'flagged',
  'blocked'
]
const SORTS = ['activity', 'orbs', 'joined', 'flags']

const INITIAL = {
  q: '',
  filter: 'all',
  platform: '',
  minFilled: '',
  sort: 'activity',
  page: 1
}

const ParticipantsTab = ({ campaign, campaignId }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [params, setParams] = useState(INITIAL)
  const [search, setSearch] = useState('')
  const [direct, setDirect] = useState('')
  const [openUser, setOpenUser] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  const query = { ...params, pageSize: PAGE_SIZE }
  const { data, error, loading, reload } = useOrbResource(
    signal => listParticipants(campaignId, query, { signal }),
    `${campaignId}:${JSON.stringify(params)}`
  )
  const total = data?.total || 0
  const slotsTotal = campaign?.orbCount

  const set = patch =>
    setParams(prev => ({ ...prev, ...patch, page: patch.page || 1 }))

  const exportCsv = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const result = await listParticipants(campaignId, {
        ...params,
        page: 1,
        pageSize: EXPORT_SIZE,
        export: true
      })
      const columns = [
        'userId',
        'email',
        'name',
        'joinedAt',
        'lastActivityAt',
        'regularCount',
        'wildcardCount',
        'filled',
        'flagsCount',
        'platform',
        'blockedAt',
        'blockedReason',
        'wishStatus',
        'wishType',
        'wishAmount'
      ].map(key => ({ key, label: key }))
      downloadCsv(
        csvFilename('orb-participants', campaignId),
        toCsv(columns, result.rows || [])
      )
    } catch (err) {
      setExportError(err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
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
        <Field label={t('admin.orbHunt.participants.filter')}>
          <select
            value={params.filter}
            onChange={e => set({ filter: e.target.value })}
            className={inputClass}
          >
            {FILTERS.map(f => (
              <option key={f} value={f}>
                {t(`admin.orbHunt.participants.filters.${f}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.orbHunt.participants.platform')}>
          <select
            value={params.platform}
            onChange={e => set({ platform: e.target.value })}
            className={inputClass}
          >
            <option value="">
              {t('admin.orbHunt.participants.anyPlatform')}
            </option>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
        </Field>
        <Field label={t('admin.orbHunt.participants.minFilled')}>
          <input
            type="number"
            min={0}
            max={slotsTotal || 12}
            value={params.minFilled}
            onChange={e => set({ minFilled: e.target.value })}
            className={`${inputClass} af-num`}
          />
        </Field>
        <Field label={t('admin.orbHunt.participants.sort')}>
          <select
            value={params.sort}
            onChange={e => set({ sort: e.target.value })}
            className={inputClass}
          >
            {SORTS.map(s => (
              <option key={s} value={s}>
                {t(`admin.orbHunt.participants.sorts.${s}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          className="flex items-end gap-2"
          onSubmit={e => {
            e.preventDefault()
            if (direct.trim()) setOpenUser(direct.trim())
          }}
        >
          <Field label={t('admin.orbHunt.participants.openDirect')}>
            <input
              value={direct}
              onChange={e => setDirect(e.target.value)}
              placeholder={t(
                'admin.orbHunt.participants.openDirectPlaceholder'
              )}
              className={`${inputClass} w-72`}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={!direct.trim()}>
            {t('admin.orbHunt.participants.open')}
          </Button>
        </form>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setParams(INITIAL)
            }}
          >
            {t('admin.orbHunt.common.reset')}
          </Button>
          <Button
            variant="secondary"
            loading={exporting}
            onClick={exportCsv}
            disabled={!total}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {t('admin.orbHunt.common.exportCsv')}
          </Button>
        </div>
      </div>

      {exportError ? <ApiError error={exportError} /> : null}
      <ApiError error={error} />

      {data && !data.rows.length ? (
        <EmptyState
          title={t('admin.orbHunt.participants.emptyTitle')}
          hint={t('admin.orbHunt.participants.emptyHint')}
        />
      ) : (
        <div
          className={`af-fade ${loading && data ? 'opacity-60' : ''}`}
          aria-busy={loading}
        >
          <TableShell caption={t('admin.orbHunt.tabs.participants')}>
            <thead>
              <tr>
                <Th>{t('admin.orbHunt.participants.user')}</Th>
                <Th>{t('admin.orbHunt.participants.progress')}</Th>
                <Th>{t('admin.orbHunt.participants.wish')}</Th>
                <Th>{t('admin.orbHunt.participants.flags')}</Th>
                <Th>{t('admin.orbHunt.participants.platform')}</Th>
                <Th>{t('admin.orbHunt.participants.lastActivity')}</Th>
                <Th>{t('admin.orbHunt.participants.joined')}</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map(row => (
                <tr
                  key={row.userId}
                  tabIndex={0}
                  onClick={() => setOpenUser(row.userId)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setOpenUser(row.userId)
                    }
                  }}
                  aria-label={t('admin.orbHunt.participants.openRow', {
                    name: row.name || row.email || row.userId
                  })}
                  className="cursor-pointer transition-colors hover:bg-violet-50/50 focus:bg-violet-50 focus:outline-none"
                >
                  <Td>
                    <p className="font-medium text-slate-900">
                      {row.name || '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.email || row.userId}
                    </p>
                    {row.blockedAt ? (
                      <Badge className="mt-1 bg-rose-50 text-rose-800 ring-rose-600/25">
                        {t('admin.orbHunt.participants.blocked')}
                      </Badge>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="af-num font-semibold">
                        {row.filled}
                        {slotsTotal ? `/${slotsTotal}` : ''}
                      </span>
                      {slotsTotal ? (
                        <span
                          className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"
                          aria-hidden="true"
                        >
                          <span
                            className={`af-bar-fill block h-full ${row.filled >= slotsTotal ? 'bg-emerald-600' : 'bg-violet-600'}`}
                            style={{
                              transform: `scaleX(${Math.min(1, row.filled / slotsTotal)})`
                            }}
                          />
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      {t('admin.orbHunt.participants.counts', {
                        regular: row.regularCount,
                        wildcards: row.wildcardCount
                      })}
                    </p>
                  </Td>
                  <Td>
                    {row.wishStatus ? (
                      <Badge className={WISH_STATUS_STYLE[row.wishStatus]}>
                        {t(`admin.orbHunt.wishStatus.${row.wishStatus}`)} ·{' '}
                        {row.wishAmount}{' '}
                        {t(`admin.orbHunt.wishUnits.${row.wishType}`)}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {row.flagsCount ? (
                      <Badge className={FLAG_STYLE}>{row.flagsCount}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </Td>
                  <Td className="uppercase text-slate-600">
                    {row.platform || '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatDateTime(row.lastActivityAt, lang)}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatDateTime(row.joinedAt, lang)}
                  </Td>
                </tr>
              ))}
              {!data && loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i}>
                      <Td className="py-3" colSpan={7}>
                        <div className="af-skeleton h-6 w-full" />
                      </Td>
                    </tr>
                  ))
                : null}
            </tbody>
          </TableShell>
          {data ? (
            <Pagination
              page={params.page}
              pageSize={PAGE_SIZE}
              total={total}
              onPage={page => set({ page })}
            />
          ) : null}
        </div>
      )}

      {openUser ? (
        <ParticipantDetail
          campaignId={campaignId}
          user={openUser}
          onClose={() => setOpenUser(null)}
          onChanged={reload}
        />
      ) : null}
    </div>
  )
}

export default ParticipantsTab
