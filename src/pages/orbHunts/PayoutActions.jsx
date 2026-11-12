import { useTranslation } from 'react-i18next'

import { retryPayout, revertPayout } from '../../services/orbHuntApi'

import { ConfirmModal } from './Modal'

/** One-line outcome of a revert: coins taken back, shortfall, whitelist. */
export const revertSummary = (t, result) => {
  const parts = [t('admin.orbHunt.payouts.reverted')]
  if (result?.coinsTakenBack !== undefined && result?.coinsTakenBack !== null) {
    parts.push(
      t('admin.orbHunt.payouts.coinsTakenBack', {
        count: result.coinsTakenBack
      })
    )
  }
  if (result?.shortfall) {
    parts.push(
      t('admin.orbHunt.payouts.shortfall', { count: result.shortfall })
    )
  }
  if (result?.whitelist) {
    parts.push(t(`admin.orbHunt.payouts.whitelist.${result.whitelist}`))
  }
  return parts.join(' · ')
}

/**
 * Retry (FAILED or stuck PENDING) or revert a wish. Both need a note (audit log).
 * `onDone(result)`: Wish for retry, `{ wish, coinsTakenBack?, … }` for revert.
 */
export const PayoutActionModal = ({ type, wish, onClose, onDone }) => {
  const { t } = useTranslation()
  const isRevert = type === 'revert'
  return (
    <ConfirmModal
      title={t(`admin.orbHunt.payouts.confirm.${type}.title`)}
      message={t(`admin.orbHunt.payouts.confirm.${type}.message`, {
        amount: wish.amount,
        unit: t(`admin.orbHunt.wishUnits.${wish.type}`)
      })}
      confirmLabel={
        isRevert
          ? t('admin.orbHunt.payouts.revert')
          : t('admin.orbHunt.payouts.retry')
      }
      tone={isRevert ? 'danger' : 'warn'}
      requireNote
      onConfirm={async note => {
        const result = isRevert
          ? await revertPayout(wish.id, note)
          : await retryPayout(wish.id, note)
        onDone(result)
      }}
      onClose={onClose}
    />
  )
}
