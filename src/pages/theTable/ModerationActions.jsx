import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowUturnLeftIcon,
  CheckBadgeIcon,
  EyeSlashIcon,
  NoSymbolIcon,
  ShieldCheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

import {
  banUser,
  dismissReport,
  hidePost,
  restorePost,
  unbanUser
} from '../../services/tableApi'
import { ConfirmModal } from '../orbHunts/Modal'
import { Button } from '../orbHunts/ui'

import { HIDDEN_STATUSES, notifyReportsChanged } from './model'

/**
 * Every action: confirm dialog → API call → `onDone()` (the caller refetches).
 * `note` = optional free-text note for the audit log.
 */
const ACTIONS = {
  hide: {
    icon: EyeSlashIcon,
    variant: 'danger',
    note: true,
    run: ({ post }, note) => hidePost(post.id, note)
  },
  restore: {
    icon: ArrowUturnLeftIcon,
    variant: 'success',
    run: ({ post }) => restorePost(post.id)
  },
  // restore also approves a PENDING photo (photoCheck → OK) on a VISIBLE post.
  approvePhoto: {
    icon: CheckBadgeIcon,
    variant: 'success',
    run: ({ post }) => restorePost(post.id)
  },
  dismiss: {
    icon: XMarkIcon,
    variant: 'secondary',
    run: ({ reportId }) => dismissReport(reportId)
  },
  ban: {
    icon: NoSymbolIcon,
    variant: 'danger',
    note: true,
    run: ({ user }, note) => banUser(user.userId, note)
  },
  unban: {
    icon: ShieldCheckIcon,
    variant: 'secondary',
    run: ({ user }) => unbanUser(user.userId)
  }
}

/** Which actions apply to this post / user / report. */
const availableActions = ({ post, user, reportId, canDismiss }) => {
  const ids = []
  if (post && post.status !== 'HIDDEN_ADMIN' && post.status !== 'DELETED') {
    ids.push('hide')
  }
  if (post && HIDDEN_STATUSES.has(post.status)) ids.push('restore')
  if (post?.status === 'VISIBLE' && post.photoCheck === 'PENDING') {
    ids.push('approvePhoto')
  }
  if (reportId && canDismiss) ids.push('dismiss')
  if (user?.userId) ids.push(user.bannedAt ? 'unban' : 'ban')
  return ids
}

const ModerationActions = ({ post, user, reportId, canDismiss, onDone }) => {
  const { t } = useTranslation()
  const [pending, setPending] = useState(null)
  const target = { post, user, reportId }
  const ids = availableActions({ post, user, reportId, canDismiss })
  if (!ids.length) return null

  const action = pending ? ACTIONS[pending] : null
  const userName = user?.name || user?.userId || ''

  return (
    <div className="flex flex-wrap gap-2">
      {ids.map(id => {
        const Icon = ACTIONS[id].icon
        return (
          <Button
            key={id}
            size="sm"
            variant={ACTIONS[id].variant}
            onClick={() => setPending(id)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {t(`admin.theTable.actions.${id}`)}
          </Button>
        )
      })}

      {action ? (
        <ConfirmModal
          title={t(`admin.theTable.confirm.${pending}.title`)}
          message={t(`admin.theTable.confirm.${pending}.message`, {
            name: userName
          })}
          confirmLabel={t(`admin.theTable.actions.${pending}`)}
          tone={action.variant === 'secondary' ? 'primary' : action.variant}
          optionalNote={Boolean(action.note)}
          onConfirm={async note => {
            await action.run(target, note || undefined)
            notifyReportsChanged()
            onDone?.()
          }}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  )
}

export default ModerationActions
