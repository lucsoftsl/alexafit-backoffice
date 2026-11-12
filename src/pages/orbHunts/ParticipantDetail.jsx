import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  addNote,
  getParticipant,
  grantOrb,
  resetProgress,
  revokeOrb,
  setBlocked
} from '../../services/orbHuntApi'
import { formatNumber } from '../../components/admin/format'

import { ApiError, ConfirmModal, Drawer } from './Modal'
import { formatDateTime } from './model'
import {
  AttemptsTimeline,
  AuditList,
  OrbHistory,
  SlotGrid,
  SpawnList,
  WishCard
} from './ParticipantSections'
import { PayoutActionModal, revertSummary } from './PayoutActions'
import { Badge, Button, Card, Field, SuccessBanner, inputClass } from './ui'
import useOrbResource from './useOrbResource'

const GrantFields = ({ slots, value, onChange }) => {
  const { t } = useTranslation()
  const empty = slots.filter(s => !s.orb)
  return (
    <div className="space-y-3">
      <fieldset className="flex gap-4 text-sm">
        <legend className="sr-only">
          {t('admin.orbHunt.detail.grantKind')}
        </legend>
        {['REGULAR', 'SUPER'].map(kind => (
          <label key={kind} className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="grant-kind"
              checked={value.kind === kind}
              onChange={() => onChange({ ...value, kind })}
              className="accent-violet-700"
            />
            {t(`admin.orbHunt.detail.grant${kind}`)}
          </label>
        ))}
      </fieldset>
      {value.kind === 'REGULAR' ? (
        <Field label={t('admin.orbHunt.detail.grantSlot')}>
          <select
            value={value.orbId}
            onChange={e => onChange({ ...value, orbId: e.target.value })}
            className={inputClass}
          >
            <option value="">{t('admin.orbHunt.detail.pickSlot')}</option>
            {empty.map(s => (
              <option key={s.id} value={s.id}>
                #{s.slot} · {t(`admin.orbHunt.sourceTypes.${s.sourceType}`)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="text-xs text-slate-500">
          {t('admin.orbHunt.detail.superHint')}
        </p>
      )}
    </div>
  )
}

/** Drawer with everything about one participant plus support actions. */
const ParticipantDetail = ({ campaignId, user, onClose, onChanged }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { data, error, loading, setData, reload } = useOrbResource(
    signal => getParticipant(campaignId, user, { signal }),
    `${campaignId}:${user}`
  )
  const [action, setAction] = useState(null)
  const [grant, setGrant] = useState({ kind: 'REGULAR', orbId: '' })
  const [notice, setNotice] = useState(null)

  const userId = data?.user?.userId || data?.participant?.userId || user
  const blocked = Boolean(data?.participant?.blockedAt)

  const apply = (detail, message) => {
    setData(detail)
    setNotice(message)
    onChanged?.()
  }

  const ACTIONS = {
    grant: {
      tone: 'primary',
      run: note =>
        grantOrb(
          campaignId,
          userId,
          grant.kind === 'REGULAR'
            ? { kind: 'REGULAR', orbId: grant.orbId, note }
            : { kind: 'SUPER', note }
        )
    },
    revoke: { tone: 'danger', run: note => revokeOrb(action.orb.id, note) },
    reset: {
      tone: 'danger',
      run: note => resetProgress(campaignId, userId, note)
    },
    block: {
      tone: blocked ? 'success' : 'danger',
      run: note => setBlocked(campaignId, userId, !blocked, note)
    },
    note: { tone: 'primary', run: note => addNote(campaignId, userId, note) }
  }

  const runAction = async note => {
    const detail = await ACTIONS[action.type].run(note)
    apply(
      detail,
      t(
        `admin.orbHunt.detail.done.${action.type === 'block' && blocked ? 'unblock' : action.type}`
      )
    )
  }

  const wildcards = (data?.orbs || []).filter(
    o => o.kind !== 'REGULAR' && o.status === 'ACTIVE'
  )
  const grantDisabled = grant.kind === 'REGULAR' && !grant.orbId

  return (
    <Drawer
      title={data?.user?.name || data?.user?.email || user}
      subtitle={
        data?.user?.email && data?.user?.name ? data.user.email : userId
      }
      onClose={onClose}
    >
      <div className="space-y-5">
        <ApiError error={error} />
        {notice ? (
          <SuccessBanner onDismiss={() => setNotice(null)}>
            {notice}
          </SuccessBanner>
        ) : null}
        {loading && !data ? (
          <div className="space-y-3" aria-busy="true">
            <div className="af-skeleton h-24 w-full rounded-3xl" />
            <div className="af-skeleton h-64 w-full rounded-3xl" />
          </div>
        ) : null}

        {data ? (
          <>
            <Card>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-slate-500">
                    {t('admin.orbHunt.detail.userId')}
                  </dt>
                  <dd
                    className="truncate font-mono text-xs text-slate-800"
                    title={userId}
                  >
                    {userId}
                  </dd>
                  <dt className="text-slate-500">
                    {t('admin.orbHunt.detail.userType')}
                  </dt>
                  <dd className="text-slate-800">
                    {data.user?.userType || '—'} · {data.user?.status || '—'}
                  </dd>
                  <dt className="text-slate-500">
                    {t('admin.orbHunt.detail.joined')}
                  </dt>
                  <dd className="text-slate-800">
                    {formatDateTime(data.participant?.joinedAt, lang)}
                  </dd>
                  <dt className="text-slate-500">
                    {t('admin.orbHunt.detail.lastActivity')}
                  </dt>
                  <dd className="text-slate-800">
                    {formatDateTime(data.participant?.lastActivityAt, lang)}
                  </dd>
                  <dt className="text-slate-500">
                    {t('admin.orbHunt.participants.platform')}
                  </dt>
                  <dd className="uppercase text-slate-800">
                    {data.participant?.platform || '—'}
                  </dd>
                </dl>
                <div className="rounded-2xl bg-amber-50 px-5 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    {t('admin.orbHunt.detail.coins')}
                  </p>
                  <p className="af-num text-3xl font-semibold text-amber-900">
                    {data.coins === null || data.coins === undefined
                      ? '—'
                      : formatNumber(data.coins, lang)}
                  </p>
                </div>
              </div>
              {!data.participant ? (
                <p className="mt-3 text-sm text-slate-600">
                  {t('admin.orbHunt.detail.notJoined')}
                </p>
              ) : null}
              {blocked ? (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {t('admin.orbHunt.detail.blockedSince', {
                    when: formatDateTime(data.participant.blockedAt, lang),
                    reason: data.participant.blockedReason || '—'
                  })}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setAction({ type: 'grant' })}
                >
                  {t('admin.orbHunt.detail.grant')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setAction({ type: 'note' })}
                >
                  {t('admin.orbHunt.detail.addNote')}
                </Button>
                <Button
                  size="sm"
                  variant={blocked ? 'success' : 'warn'}
                  onClick={() => setAction({ type: 'block' })}
                >
                  {blocked
                    ? t('admin.orbHunt.detail.unblock')
                    : t('admin.orbHunt.detail.block')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setAction({ type: 'reset' })}
                >
                  {t('admin.orbHunt.detail.reset')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={loading}
                  onClick={reload}
                >
                  {t('admin.orbHunt.common.refresh')}
                </Button>
              </div>
            </Card>

            <SlotGrid slots={data.slots || []} completion={data.completion} />

            <Card
              eyebrow={t('admin.orbHunt.detail.wildcardsEyebrow')}
              title={t('admin.orbHunt.detail.wildcards', {
                count: wildcards.length
              })}
            >
              {wildcards.length ? (
                <ul className="flex flex-wrap gap-2">
                  {wildcards.map(w => (
                    <li key={w.id}>
                      <Badge
                        className={
                          w.kind === 'SUPER'
                            ? 'bg-violet-50 text-violet-800 ring-violet-600/25'
                            : 'bg-sky-50 text-sky-800 ring-sky-600/25'
                        }
                      >
                        {t(`admin.orbHunt.kinds.${w.kind}`)} ·{' '}
                        {formatDateTime(w.collectedAt, lang)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  {t('admin.orbHunt.detail.noWildcards')}
                </p>
              )}
            </Card>

            <WishCard
              wish={data.wish}
              onRetry={wish => setAction({ type: 'retry', wish })}
              onRevert={wish => setAction({ type: 'revert', wish })}
            />
            <OrbHistory
              orbs={data.orbs || []}
              slots={data.slots || []}
              pins={data.pins || []}
              onRevoke={orb => setAction({ type: 'revoke', orb })}
            />
            <AttemptsTimeline attempts={data.attempts || []} />
            <SpawnList spawns={data.spawns || []} />
            <AuditList entries={data.audit || []} />
          </>
        ) : null}
      </div>

      {action && ACTIONS[action.type] ? (
        <ConfirmModal
          title={t(
            `admin.orbHunt.detail.confirm.${action.type === 'block' && blocked ? 'unblock' : action.type}.title`
          )}
          message={t(
            `admin.orbHunt.detail.confirm.${action.type === 'block' && blocked ? 'unblock' : action.type}.message`
          )}
          confirmLabel={t('admin.orbHunt.common.confirm')}
          tone={ACTIONS[action.type].tone}
          requireNote
          onConfirm={async note => {
            if (action.type === 'grant' && grantDisabled) {
              throw Object.assign(
                new Error(t('admin.orbHunt.detail.pickSlot')),
                { code: 'PICK_SLOT' }
              )
            }
            await runAction(note)
          }}
          onClose={() => setAction(null)}
        >
          {action.type === 'grant' ? (
            <GrantFields
              slots={data?.slots || []}
              value={grant}
              onChange={setGrant}
            />
          ) : null}
        </ConfirmModal>
      ) : null}

      {action && (action.type === 'retry' || action.type === 'revert') ? (
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
            onChanged?.()
          }}
        />
      ) : null}
    </Drawer>
  )
}

export default ParticipantDetail
