import { useTranslation } from 'react-i18next'
import { PhotoIcon } from '@heroicons/react/24/outline'

import { formatDateTime } from '../orbHunts/model'
import { Badge, JsonBlock } from '../orbHunts/ui'

import { GROUP_STYLE, POST_STATUS_STYLE, payloadParams } from './model'
import UserChip from './UserChip'

const THUMB_PX = 96

/** One-line, human summary of a post's payload snapshot. */
export const PayloadSummary = ({ type, payload }) => {
  const { t } = useTranslation()
  return (
    <p className="text-sm text-slate-700">
      {t(`admin.theTable.payload.${type}`, {
        ...payloadParams(type, payload),
        defaultValue: type
      })}
    </p>
  )
}

const Thumbnail = ({ url, label }) =>
  url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="af-focus group block shrink-0 overflow-hidden rounded-2xl border border-slate-200"
      aria-label={label}
    >
      <img
        src={url}
        alt=""
        width={THUMB_PX}
        height={THUMB_PX}
        loading="lazy"
        className="h-24 w-24 object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </a>
  ) : (
    <span
      className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-300"
      aria-hidden="true"
    >
      <PhotoIcon className="h-7 w-7" />
    </span>
  )

/**
 * Compact post card: thumbnail, type/group/status badges, author, caption,
 * payload summary and (collapsible) raw payload.
 */
const PostPreview = ({ post, onFilterUser }) => {
  const { t, i18n } = useTranslation()
  if (!post) return null
  const pendingPhoto = post.photoCheck === 'PENDING'
  return (
    <article className="flex gap-4">
      <Thumbnail
        url={post.photoUrl}
        label={t('admin.theTable.post.openPhoto')}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="bg-slate-900 text-white ring-slate-900">
            {t(`admin.theTable.types.${post.type}`, {
              defaultValue: post.type
            })}
          </Badge>
          {post.group ? (
            <Badge className={GROUP_STYLE[post.group] || ''}>
              {t(`admin.theTable.groups.${post.group}`)}
            </Badge>
          ) : null}
          {post.status ? (
            <Badge className={POST_STATUS_STYLE[post.status] || ''}>
              {t(`admin.theTable.postStatus.${post.status}`, {
                defaultValue: post.status
              })}
            </Badge>
          ) : null}
          {post.reportCount ? (
            <Badge className="bg-rose-50 text-rose-800 ring-rose-600/30">
              {t('admin.theTable.post.reports', { count: post.reportCount })}
            </Badge>
          ) : null}
          {pendingPhoto ? (
            <Badge className="bg-amber-50 text-amber-800 ring-amber-600/30">
              {t('admin.theTable.post.photoPending')}
            </Badge>
          ) : null}
          <span className="text-xs text-slate-500">
            {t(`admin.theTable.audience.${post.audience}`, {
              defaultValue: post.audience || ''
            })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {post.author ? (
            <UserChip user={post.author} onFilterUser={onFilterUser} />
          ) : (
            <span>{t('admin.theTable.post.curatedAuthor')}</span>
          )}
          <time dateTime={post.createdAt}>
            {formatDateTime(post.createdAt, i18n.language)}
          </time>
          <span className="af-num">
            {t('admin.theTable.post.likes', { count: post.likeCount ?? 0 })}
          </span>
        </div>
        {post.caption ? (
          <p className="whitespace-pre-line break-words rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-900">
            “{post.caption}”
          </p>
        ) : null}
        <PayloadSummary type={post.type} payload={post.payload} />
        <JsonBlock
          value={post.payload}
          label={t('admin.theTable.post.rawPayload')}
        />
      </div>
    </article>
  )
}

export default PostPreview
