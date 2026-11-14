import { useTranslation } from 'react-i18next'

import { ApiError } from '../orbHunts/Modal'
import { Button, EmptyState } from '../orbHunts/ui'

/**
 * Loading / error / empty / "load more" wrapper around a cursor list.
 * `list` is the result of useCursorList.
 */
const ListStates = ({ list, emptyTitle, emptyHint, children }) => {
  const { t } = useTranslation()

  if (list.loading && !list.loaded) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="af-skeleton h-36 w-full rounded-3xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ApiError error={list.error} />
      {list.loaded && !list.items.length && !list.error ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <div
          className={`space-y-3 transition-opacity ${list.loading ? 'opacity-60' : ''}`}
          aria-busy={list.loading || undefined}
        >
          {children}
        </div>
      )}
      {list.nextCursor ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            loading={list.loadingMore}
            onClick={list.loadMore}
          >
            {t('admin.theTable.common.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default ListStates
