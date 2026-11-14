import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { listPosts } from '../../services/tableApi'
import RefreshButton from '../../components/admin/RefreshButton'
import { Button, Field, inputClass } from '../orbHunts/ui'

import ListStates from './ListStates'
import ModerationActions from './ModerationActions'
import PostPreview from './PostPreview'
import useCursorList from './useCursorList'
import { POST_STATUSES } from './model'

/**
 * Browse posts. `userId` lives in the parent so other tabs can jump here
 * filtered to one author.
 */
const PostsTab = ({ userId, onUserIdChange, initialPhotoPending = false }) => {
  const { t } = useTranslation()
  const photoId = useId()
  const [status, setStatus] = useState('')
  const [photoPending, setPhotoPending] = useState(initialPhotoPending)
  const [userDraft, setUserDraft] = useState(userId)

  useEffect(() => setUserDraft(userId), [userId])

  const key = `${status}|${userId}|${photoPending}`
  const list = useCursorList(async (cursor, signal) => {
    const data = await listPosts(
      {
        status,
        userId,
        photoCheck: photoPending ? 'PENDING' : undefined,
        cursor
      },
      { signal }
    )
    return { items: data?.posts || [], nextCursor: data?.nextCursor }
  }, key)

  const applyUser = event => {
    event.preventDefault()
    onUserIdChange(userDraft.trim())
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={applyUser}
        className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-[12rem_minmax(0,1fr)_auto_auto] md:items-end"
      >
        <Field label={t('admin.theTable.posts.status')}>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="">{t('admin.theTable.posts.allStatuses')}</option>
            {POST_STATUSES.map(id => (
              <option key={id} value={id}>
                {t(`admin.theTable.postStatus.${id}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.theTable.posts.userId')}>
          <div className="flex gap-2">
            <input
              type="search"
              value={userDraft}
              onChange={e => setUserDraft(e.target.value)}
              placeholder={t('admin.theTable.posts.userIdPlaceholder')}
              className={`${inputClass} font-mono`}
              spellCheck={false}
            />
            <Button type="submit" variant="secondary">
              {t('admin.theTable.posts.apply')}
            </Button>
            {userId ? (
              <Button variant="ghost" onClick={() => onUserIdChange('')}>
                {t('admin.theTable.posts.clear')}
              </Button>
            ) : null}
          </div>
        </Field>
        <label
          htmlFor={photoId}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <input
            id={photoId}
            type="checkbox"
            checked={photoPending}
            onChange={e => setPhotoPending(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-violet-700"
          />
          {t('admin.theTable.posts.photoPending')}
        </label>
        <RefreshButton
          onClick={list.reload}
          loading={list.loading}
          label={t('admin.theTable.common.refresh')}
          compact
        />
      </form>

      <ListStates
        list={list}
        emptyTitle={t('admin.theTable.posts.empty')}
        emptyHint={t('admin.theTable.posts.emptyHint')}
      >
        {list.items.map(post => (
          <section
            key={post.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <PostPreview post={post} onFilterUser={onUserIdChange} />
            <div className="mt-4 border-t border-slate-100 pt-3">
              <ModerationActions
                post={post}
                user={post.author}
                onDone={list.reload}
              />
            </div>
          </section>
        ))}
      </ListStates>
    </div>
  )
}

export default PostsTab
