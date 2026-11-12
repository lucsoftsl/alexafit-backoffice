import { useTranslation } from 'react-i18next'

import {
  ATTEMPT_RESULT_STYLE,
  FLAG_STYLE,
  WISH_STATUS_STYLE,
  canRetryWish,
  formatDateTime
} from './model'
import { Badge, Button, Card, JsonBlock } from './ui'

const KIND_STYLE = {
  REGULAR: 'bg-slate-100 text-slate-800 ring-slate-500/20',
  SUPER: 'bg-violet-50 text-violet-800 ring-violet-600/25',
  PIN: 'bg-sky-50 text-sky-800 ring-sky-600/25'
}

const slotName = (slot, lang) => slot?.name?.[lang] || slot?.name?.en || ''

/** One tile per slot; collected ones show the orb's evidence. */
export const SlotGrid = ({ slots, completion }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  return (
    <Card
      eyebrow={t('admin.orbHunt.detail.slotsEyebrow')}
      title={t('admin.orbHunt.detail.completion', {
        filled: completion?.filled ?? 0,
        total: completion?.total ?? slots.length
      })}
      actions={
        completion?.complete ? (
          <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-600/25">
            {t('admin.orbHunt.detail.complete')}
          </Badge>
        ) : null
      }
    >
      {completion ? (
        <p className="mb-3 text-xs text-slate-500">
          {t('admin.orbHunt.detail.completionHint', completion)}
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {slots.map(slot => (
          <li
            key={slot.id}
            className={`rounded-2xl border p-3 ${
              slot.orb
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-dashed border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                #{slot.slot} ·{' '}
                {t(`admin.orbHunt.sourceTypes.${slot.sourceType}`)}
              </p>
              <span
                className={`text-xs font-semibold ${slot.orb ? 'text-emerald-700' : 'text-slate-400'}`}
              >
                {slot.orb
                  ? t('admin.orbHunt.detail.collected')
                  : t('admin.orbHunt.detail.empty')}
              </span>
            </div>
            {slotName(slot, lang) ? (
              <p className="text-xs text-slate-600">{slotName(slot, lang)}</p>
            ) : null}
            {slot.orb ? (
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>{formatDateTime(slot.orb.collectedAt, lang)}</p>
                <JsonBlock
                  value={slot.orb.evidence}
                  label={t('admin.orbHunt.detail.evidence')}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Every orb including revoked ones; ACTIVE orbs can be revoked. */
export const OrbHistory = ({ orbs, slots, pins, onRevoke }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const slotById = new Map(slots.map(s => [String(s.id).toLowerCase(), s]))
  const pinById = new Map(pins.map(p => [String(p.id).toLowerCase(), p]))
  const target = orb => {
    if (orb.kind === 'REGULAR') {
      const slot = slotById.get(String(orb.orbId).toLowerCase())
      return slot
        ? `#${slot.slot} ${t(`admin.orbHunt.sourceTypes.${slot.sourceType}`)}`
        : '—'
    }
    if (orb.kind === 'PIN')
      return pinById.get(String(orb.pinId).toLowerCase())?.name || '—'
    return orb.grantedByAdminId
      ? t('admin.orbHunt.detail.adminGrant')
      : orb.sourceRef
  }
  return (
    <Card
      eyebrow={t('admin.orbHunt.detail.historyEyebrow')}
      title={t('admin.orbHunt.detail.history')}
    >
      {!orbs.length ? (
        <p className="text-sm text-slate-500">
          {t('admin.orbHunt.detail.noOrbs')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {orbs.map(orb => {
            const revoked = orb.status !== 'ACTIVE'
            return (
              <li
                key={orb.id}
                className={`flex flex-wrap items-start justify-between gap-3 py-3 ${revoked ? 'opacity-70' : ''}`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={KIND_STYLE[orb.kind]}>
                      {t(`admin.orbHunt.kinds.${orb.kind}`)}
                    </Badge>
                    <span
                      className={`text-sm font-medium ${revoked ? 'text-slate-500 line-through' : 'text-slate-900'}`}
                    >
                      {target(orb)}
                    </span>
                    {revoked ? (
                      <Badge className="bg-rose-50 text-rose-800 ring-rose-600/25">
                        {t('admin.orbHunt.detail.revoked')}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(orb.collectedAt, lang)}
                  </p>
                  {revoked && orb.revokeReason ? (
                    <p className="text-xs text-rose-700">
                      {t('admin.orbHunt.detail.revokedBecause', {
                        when: formatDateTime(orb.revokedAt, lang),
                        reason: orb.revokeReason
                      })}
                    </p>
                  ) : null}
                  <JsonBlock
                    value={orb.evidence}
                    label={t('admin.orbHunt.detail.evidence')}
                  />
                </div>
                {!revoked ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-700 hover:bg-rose-50!"
                    onClick={() => onRevoke(orb)}
                  >
                    {t('admin.orbHunt.detail.revoke')}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export const AttemptsTimeline = ({ attempts }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  return (
    <Card
      eyebrow={t('admin.orbHunt.detail.attemptsEyebrow')}
      title={t('admin.orbHunt.detail.attempts', { count: attempts.length })}
    >
      {!attempts.length ? (
        <p className="text-sm text-slate-500">
          {t('admin.orbHunt.detail.noAttempts')}
        </p>
      ) : (
        <ol className="relative max-h-[28rem] space-y-3 overflow-y-auto border-l border-slate-200 pl-4">
          {attempts.map(a => (
            <li key={a.id} className="relative">
              <span
                className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                  a.isFlagged
                    ? 'bg-amber-500'
                    : a.result === 'OK'
                      ? 'bg-emerald-600'
                      : 'bg-slate-400'
                }`}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-900">
                  {t(`admin.orbHunt.actions.${a.action}`, {
                    defaultValue: a.action
                  })}
                </span>
                <Badge
                  className={
                    ATTEMPT_RESULT_STYLE[a.result] ||
                    ATTEMPT_RESULT_STYLE.REJECTED
                  }
                >
                  {t(`admin.orbHunt.results.${a.result}`, {
                    defaultValue: a.result
                  })}
                </Badge>
                {a.reasonCode ? (
                  <span className="text-xs text-slate-600">
                    {t(`admin.orbHunt.reasons.${a.reasonCode}`, {
                      defaultValue: a.reasonCode
                    })}
                  </span>
                ) : null}
                {a.isFlagged ? (
                  <Badge className={FLAG_STYLE}>
                    {t('admin.orbHunt.detail.flagged')}
                  </Badge>
                ) : null}
                {a.reviewDecision ? (
                  <span className="text-xs text-slate-500">
                    · {t(`admin.orbHunt.decisions.${a.reviewDecision}`)}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                {formatDateTime(a.createdAt, lang)}
              </p>
              <JsonBlock value={a.details} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

/** Spawns without coordinates (distance, status, timing only). */
export const SpawnList = ({ spawns }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  return (
    <Card
      eyebrow={t('admin.orbHunt.detail.spawnsEyebrow')}
      title={t('admin.orbHunt.detail.spawns')}
    >
      {!spawns.length ? (
        <p className="text-sm text-slate-500">
          {t('admin.orbHunt.detail.noSpawns')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {spawns.map(s => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span className="text-slate-800">
                {s.spawnDateKey} ·{' '}
                {t('admin.orbHunt.detail.spawnDistance', {
                  distance: s.distanceM,
                  radius: s.catchRadiusM
                })}
                {s.isFallback ? ` · ${t('admin.orbHunt.detail.fallback')}` : ''}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Badge className="bg-slate-100 text-slate-700 ring-slate-500/20">
                  {s.status}
                </Badge>
                {formatDateTime(s.caughtAt || s.expiresAt, lang)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export const WishCard = ({ wish, onRetry, onRevert }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  return (
    <Card
      eyebrow={t('admin.orbHunt.detail.wishEyebrow')}
      title={t('admin.orbHunt.detail.wish')}
    >
      {!wish ? (
        <p className="text-sm text-slate-500">
          {t('admin.orbHunt.detail.noWish')}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={WISH_STATUS_STYLE[wish.status]}>
              {t(`admin.orbHunt.wishStatus.${wish.status}`)}
            </Badge>
            <span className="af-num text-lg font-semibold text-slate-900">
              {wish.amount} {t(`admin.orbHunt.wishUnits.${wish.type}`)}
            </span>
            <span className="font-mono text-xs text-slate-400">
              {wish.optionId}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <dt>{t('admin.orbHunt.detail.wishCreated')}</dt>
            <dd>{formatDateTime(wish.createdAt, lang)}</dd>
            <dt>{t('admin.orbHunt.detail.wishGranted')}</dt>
            <dd>{formatDateTime(wish.grantedAt, lang)}</dd>
            {wish.revertedAt ? (
              <>
                <dt>{t('admin.orbHunt.detail.wishReverted')}</dt>
                <dd>
                  {formatDateTime(wish.revertedAt, lang)} · {wish.revertNote}
                </dd>
              </>
            ) : null}
            {wish.error ? (
              <>
                <dt>{t('admin.orbHunt.detail.wishError')}</dt>
                <dd className="text-rose-700">{wish.error}</dd>
              </>
            ) : null}
          </dl>
          <div className="flex gap-2">
            {canRetryWish(wish) ? (
              <Button size="sm" variant="warn" onClick={() => onRetry(wish)}>
                {t('admin.orbHunt.payouts.retry')}
              </Button>
            ) : null}
            {wish.status === 'GRANTED' ? (
              <Button size="sm" variant="danger" onClick={() => onRevert(wish)}>
                {t('admin.orbHunt.payouts.revert')}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  )
}

export const AuditList = ({ entries }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  return (
    <Card
      eyebrow={t('admin.orbHunt.detail.auditEyebrow')}
      title={t('admin.orbHunt.detail.audit')}
    >
      {!entries.length ? (
        <p className="text-sm text-slate-500">
          {t('admin.orbHunt.detail.noAudit')}
        </p>
      ) : (
        <ul className="space-y-3 text-sm">
          {entries.map(entry => (
            <li key={entry.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">
                  {t(`admin.orbHunt.auditActions.${entry.action}`, {
                    defaultValue: entry.action
                  })}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDateTime(entry.createdAt, lang)}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {entry.adminName || entry.adminEmail || entry.adminUserId}
              </p>
              {entry.note ? (
                <p className="mt-1 text-slate-700">“{entry.note}”</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
