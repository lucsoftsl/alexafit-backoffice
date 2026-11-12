import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { listFlags, reviewFlag } from '../../services/orbHuntApi'

import { ApiError, ConfirmModal } from './Modal'
import { FLAG_STYLE, formatDateTime } from './model'
import ParticipantDetail from './ParticipantDetail'
import {
  Badge,
  Button,
  EmptyState,
  JsonBlock,
  Pagination,
  SuccessBanner,
  TableShell,
  Td,
  Th,
  Toggle
} from './ui'
import useOrbResource from './useOrbResource'

const PAGE_SIZE = 50

/** Short human summary of the attempt details next to the raw JSON. */
const detailSummary = (t, attempt) => {
  const d = attempt.details || {}
  if (attempt.reasonCode === 'IMPOSSIBLE_TRAVEL' && d.jumpKm !== undefined) {
    return t('admin.orbHunt.fraud.travelSummary', {
      km: d.jumpKm,
      minutes: d.minutesSinceLastFix ?? '?'
    })
  }
  if (d.steps !== undefined)
    return t('admin.orbHunt.fraud.stepsSummary', { steps: d.steps })
  if (d.accuracy !== undefined) {
    return t('admin.orbHunt.fraud.gpsSummary', {
      accuracy: d.accuracy,
      mocked: d.mocked ? '✓' : '—'
    })
  }
  return null
}

const FraudTab = ({ campaignId }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [includeReviewed, setIncludeReviewed] = useState(false)
  const [page, setPage] = useState(1)
  const [review, setReview] = useState(null) // { attempt, decision }
  const [openUser, setOpenUser] = useState(null)
  const [notice, setNotice] = useState(null)

  const { data, error, loading, reload } = useOrbResource(
    signal =>
      listFlags(
        campaignId,
        {
          includeReviewed: includeReviewed ? 'true' : undefined,
          page,
          pageSize: PAGE_SIZE
        },
        { signal }
      ),
    `${campaignId}:${includeReviewed}:${page}`
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          {t('admin.orbHunt.fraud.intro')}
        </p>
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <span id="fraud-include-reviewed">
            {t('admin.orbHunt.fraud.includeReviewed')}
          </span>
          <Toggle
            checked={includeReviewed}
            label={t('admin.orbHunt.fraud.includeReviewed')}
            onChange={value => {
              setIncludeReviewed(value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {notice ? (
        <SuccessBanner onDismiss={() => setNotice(null)}>
          {notice}
        </SuccessBanner>
      ) : null}
      <ApiError error={error} />

      {data && !data.rows.length ? (
        <EmptyState
          title={t('admin.orbHunt.fraud.emptyTitle')}
          hint={t('admin.orbHunt.fraud.emptyHint')}
        />
      ) : (
        <div
          className={`af-fade ${loading && data ? 'opacity-60' : ''}`}
          aria-busy={loading}
        >
          <TableShell caption={t('admin.orbHunt.tabs.fraud')}>
            <thead>
              <tr>
                <Th>{t('admin.orbHunt.participants.user')}</Th>
                <Th>{t('admin.orbHunt.fraud.reason')}</Th>
                <Th>{t('admin.orbHunt.fraud.details')}</Th>
                <Th>{t('admin.orbHunt.fraud.flagCount')}</Th>
                <Th>{t('admin.orbHunt.fraud.when')}</Th>
                <Th className="text-right">
                  {t('admin.orbHunt.campaigns.actions')}
                </Th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map(row => {
                const summary = detailSummary(t, row)
                return (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-amber-50/40"
                  >
                    <Td>
                      <button
                        type="button"
                        onClick={() => setOpenUser(row.userId)}
                        className="af-focus rounded text-left hover:text-violet-800"
                      >
                        <p className="font-medium text-slate-900 underline-offset-2 hover:underline">
                          {row.name || '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.email || row.userId}
                        </p>
                      </button>
                      {row.blockedAt ? (
                        <Badge className="mt-1 bg-rose-50 text-rose-800 ring-rose-600/25">
                          {t('admin.orbHunt.participants.blocked')}
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge className={FLAG_STYLE}>
                        {t(`admin.orbHunt.reasons.${row.reasonCode}`, {
                          defaultValue: row.reasonCode
                        })}
                      </Badge>
                      <p className="mt-1 text-xs text-slate-500">
                        {t(`admin.orbHunt.actions.${row.action}`, {
                          defaultValue: row.action
                        })}
                      </p>
                    </Td>
                    <Td>
                      {summary ? (
                        <p className="text-xs text-slate-700">{summary}</p>
                      ) : null}
                      <JsonBlock value={row.details} />
                    </Td>
                    <Td className="af-num font-semibold text-amber-800">
                      {row.flagsCount ?? '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-slate-600">
                      {formatDateTime(row.createdAt, lang)}
                      {row.reviewedAt ? (
                        <p className="text-slate-500">
                          {t(`admin.orbHunt.decisions.${row.reviewDecision}`, {
                            defaultValue: row.reviewDecision
                          })}{' '}
                          · {formatDateTime(row.reviewedAt, lang)}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      {!row.reviewedAt ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setReview({ attempt: row, decision: 'DISMISSED' })
                            }
                          >
                            {t('admin.orbHunt.fraud.dismiss')}
                          </Button>
                          {!row.blockedAt ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() =>
                                setReview({ attempt: row, decision: 'BLOCKED' })
                              }
                            >
                              {t('admin.orbHunt.fraud.block')}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                )
              })}
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

      {review ? (
        <ConfirmModal
          title={t(`admin.orbHunt.fraud.confirm.${review.decision}.title`)}
          message={t(`admin.orbHunt.fraud.confirm.${review.decision}.message`, {
            user: review.attempt.email || review.attempt.userId
          })}
          confirmLabel={
            review.decision === 'BLOCKED'
              ? t('admin.orbHunt.fraud.block')
              : t('admin.orbHunt.fraud.dismiss')
          }
          tone={review.decision === 'BLOCKED' ? 'danger' : 'primary'}
          requireNote={review.decision === 'BLOCKED'}
          optionalNote={review.decision === 'DISMISSED'}
          onConfirm={async note => {
            await reviewFlag(
              review.attempt.id,
              review.decision,
              note || undefined
            )
            setNotice(t(`admin.orbHunt.fraud.done.${review.decision}`))
            reload()
          }}
          onClose={() => setReview(null)}
        />
      ) : null}

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

export default FraudTab
