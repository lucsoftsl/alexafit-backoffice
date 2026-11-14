import { useTranslation } from 'react-i18next'

import { Badge } from '../orbHunts/ui'

import { shortId } from './model'

/**
 * Name / e-mail / short uid of a user. With `onFilterUser`, the name is a
 * button that opens the Posts tab filtered to that user.
 */
const UserChip = ({ user, onFilterUser, showBan = false }) => {
  const { t } = useTranslation()
  if (!user) return <span className="text-slate-400">—</span>
  const name = user.name || t('admin.theTable.user.noName')
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {onFilterUser && user.userId ? (
        <button
          type="button"
          onClick={() => onFilterUser(user.userId)}
          title={t('admin.theTable.user.viewPosts')}
          className="af-focus rounded font-semibold text-violet-700 underline-offset-2 hover:underline"
        >
          {name}
        </button>
      ) : (
        <span className="font-semibold text-slate-800">{name}</span>
      )}
      {user.email ? (
        <span className="truncate text-slate-500">{user.email}</span>
      ) : null}
      <code className="text-[11px] text-slate-400" title={user.userId}>
        {shortId(user.userId)}
      </code>
      {showBan && user.bannedAt ? (
        <Badge className="bg-rose-50 text-rose-800 ring-rose-600/30">
          {t('admin.theTable.user.banned')}
        </Badge>
      ) : null}
    </span>
  )
}

export default UserChip
