import { useTranslation } from 'react-i18next'

import { formatAgo } from './format'
import { useNow } from './motion'

/** "Updated 3 min ago", re-rendered every 30s; full time on hover. */
const UpdatedAgo = ({ at, className = '' }) => {
  const { t, i18n } = useTranslation()
  const now = useNow()
  if (!at) return null
  const ago = formatAgo(at, now, i18n.language)
  return (
    <time
      dateTime={new Date(at).toISOString()}
      title={new Date(at).toLocaleString(i18n.language)}
      className={`text-xs text-slate-500 ${className}`}
    >
      {t('admin.common.updatedAgo', { ago })}
    </time>
  )
}

export default UpdatedAgo
