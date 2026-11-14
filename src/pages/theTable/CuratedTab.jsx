import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PencilSquareIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

import { deleteCurated, listCurated } from '../../services/tableApi'
import RefreshButton from '../../components/admin/RefreshButton'
import { formatDate } from '../orbHunts/model'
import { ApiError, ConfirmModal } from '../orbHunts/Modal'
import { Badge, Button, EmptyState } from '../orbHunts/ui'
import useOrbResource from '../orbHunts/useOrbResource'

import CuratedGroupEditor from './CuratedGroupEditor'
import { CURATED_LANGS } from './model'
import { CURATED_STATE_STYLE } from './curatedForm'
import { groupPosts } from './curatedGroups'

const LangChips = ({ versions }) => (
  <div className="flex flex-wrap gap-1">
    {CURATED_LANGS.map(code => {
      const has = Boolean(versions[code])
      return (
        <span
          key={code}
          title={code.toUpperCase()}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
            has
              ? 'bg-violet-100 text-violet-800'
              : 'bg-slate-100 text-slate-400 line-through'
          }`}
        >
          {code}
        </span>
      )
    })}
  </div>
)

const GroupRow = ({ group, onEdit, onDelete }) => {
  const { t, i18n } = useTranslation()
  const { primary, versions, state } = group
  const payload = primary.payload || {}
  const count = Object.keys(versions).length
  return (
    <section className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => onEdit(group)}
        className="h-24 w-40 shrink-0 overflow-hidden rounded-2xl bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        aria-label={t('admin.theTable.curated.edit')}
      >
        {primary.photoUrl ? (
          <img
            src={primary.photoUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="af-num font-semibold text-slate-700">
            #{group.sortOrder}
          </span>
          <Badge className={CURATED_STATE_STYLE[state]}>
            {t(`admin.theTable.curatedState.${state}`)}
          </Badge>
          <span>
            {primary.startsAt || primary.endsAt
              ? `${formatDate(primary.startsAt, i18n.language)} → ${formatDate(primary.endsAt, i18n.language)}`
              : t('admin.theTable.curated.always')}
          </span>
          <span>{t('admin.theTable.curated.langCount', { count })}</span>
        </div>
        <p className="truncate font-semibold text-slate-900">
          {payload.title ||
            payload.name ||
            t(`admin.theTable.types.${primary.type}`)}
        </p>
        {payload.body ? (
          <p className="line-clamp-2 text-sm text-slate-600">{payload.body}</p>
        ) : null}
        <div className="mt-2">
          <LangChips versions={versions} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <Button size="sm" onClick={() => onEdit(group)}>
          <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
          {t('admin.theTable.curated.edit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(group)}>
          <TrashIcon className="h-4 w-4" aria-hidden="true" />
          {t('admin.theTable.curated.delete')}
        </Button>
      </div>
    </section>
  )
}

/** Curated posts shown when a user's feed is empty: one row per post, all languages inside. */
const CuratedTab = () => {
  const { t } = useTranslation()
  const { data, error, loading, reload } = useOrbResource(
    signal => listCurated({ signal }),
    'curated'
  )
  const [editing, setEditing] = useState(null) // null | { group }
  const [deleting, setDeleting] = useState(null)
  const groups = groupPosts(data?.posts || [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          {t('admin.theTable.curated.intro')}
        </p>
        <div className="flex gap-2">
          <RefreshButton
            onClick={reload}
            loading={loading}
            label={t('admin.theTable.common.refresh')}
            compact
          />
          <Button variant="primary" onClick={() => setEditing({ group: null })}>
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            {t('admin.theTable.curated.new')}
          </Button>
        </div>
      </div>
      <ApiError error={error} />

      {loading && !data ? (
        <div className="space-y-3" aria-busy="true">
          <div className="af-skeleton h-28 w-full rounded-3xl" />
          <div className="af-skeleton h-28 w-full rounded-3xl" />
        </div>
      ) : data && !groups.length ? (
        <EmptyState
          title={t('admin.theTable.curated.empty')}
          hint={t('admin.theTable.curated.emptyHint')}
        />
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <GroupRow
              key={group.key}
              group={group}
              onEdit={g => setEditing({ group: g })}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {editing ? (
        <CuratedGroupEditor
          group={editing.group}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmModal
          title={t('admin.theTable.curated.deleteTitle')}
          message={t('admin.theTable.curated.deleteGroupMessage', {
            count: Object.keys(deleting.versions).length
          })}
          confirmLabel={t('admin.theTable.curated.delete')}
          tone="danger"
          onConfirm={async () => {
            for (const post of Object.values(deleting.versions)) {
              await deleteCurated(post.id)
            }
            reload()
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}

export default CuratedTab
