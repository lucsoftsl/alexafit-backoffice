import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatBytes, formatCompact } from './format'
import Panel from './Panel'
import QuotaBar from './QuotaBar'
import Skeleton from './Skeleton'

const TOP_TABLES = 6

/**
 * Size of one database: used vs quota, data/index split, biggest tables.
 * `accent` is the engine's identity color (Azure SQL blue, TiDB aqua).
 */
const DatabaseSizeCard = ({ title, engineLabel, accent, resource }) => {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const { data, error, loading, refreshing, updatedAt, reload } = resource

  const totals = data?.totals
  const used = totals?.usedBytes || totals?.reservedBytes || 0
  const split = useMemo(() => {
    const dataBytes = totals?.dataBytes || 0
    const indexBytes = totals?.indexBytes || 0
    const sum = dataBytes + indexBytes
    return sum ? { data: dataBytes / sum, index: indexBytes / sum } : null
  }, [totals])
  const tables = data?.tables || []
  const visibleTables = expanded ? tables : tables.slice(0, TOP_TABLES)
  const biggest = tables[0]?.reservedBytes || 1

  return (
    <Panel
      eyebrow={engineLabel}
      title={title}
      onRefresh={() => reload(true)}
      refreshing={refreshing}
      refreshLabel={t('admin.common.refresh')}
      updatedAt={updatedAt}
      className="af-lift"
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton lines={4} />
        </div>
      ) : error && !data ? (
        <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
          {t('admin.db.loadFailed')}{' '}
          <span className="text-rose-600/80">({error.message})</span>
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <p className="af-num text-4xl font-semibold text-slate-900">
              {formatBytes(used)}
            </p>
            <p className="text-right text-xs text-slate-500">
              {t('admin.db.rowsTables', {
                rows: formatCompact(totals?.rows, i18n.language),
                tables: tables.length
              })}
              {data?.estimated ? (
                <span className="block text-slate-400">
                  {t('admin.db.estimated')}
                </span>
              ) : null}
            </p>
          </div>

          <QuotaBar
            used={used}
            quota={totals?.quotaBytes}
            label={t('admin.db.storage')}
          />

          {split ? (
            <div>
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-l-full"
                  style={{ flexGrow: split.data, background: accent }}
                />
                <div
                  className="h-full rounded-r-full bg-slate-300"
                  style={{ flexGrow: split.index }}
                />
              </div>
              <div className="mt-2 flex gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: accent }}
                  />
                  {t('admin.db.data')} {formatBytes(totals?.dataBytes)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  {t('admin.db.indexes')} {formatBytes(totals?.indexBytes)}
                </span>
              </div>
            </div>
          ) : null}

          {tables.length ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t('admin.db.biggestTables')}
              </p>
              <ul className="space-y-1.5">
                {visibleTables.map(row => (
                  <li
                    key={`${row.schema}.${row.table}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm"
                  >
                    <span className="truncate font-mono text-xs text-slate-700">
                      {row.schema && row.schema !== 'dbo'
                        ? `${row.schema}.${row.table}`
                        : row.table}
                    </span>
                    <span className="af-num text-xs text-slate-500">
                      {formatBytes(row.reservedBytes)} ·{' '}
                      {formatCompact(row.rows, i18n.language)}{' '}
                      {t('admin.db.rows')}
                    </span>
                    <span className="col-span-2 h-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="af-bar-fill block h-full w-full rounded-full"
                        style={{
                          background: accent,
                          opacity: 0.7,
                          transform: `scaleX(${row.reservedBytes / biggest})`
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
              {tables.length > TOP_TABLES ? (
                <button
                  type="button"
                  onClick={() => setExpanded(v => !v)}
                  className="af-underline af-focus mt-3 text-xs font-semibold text-violet-700"
                >
                  {expanded
                    ? t('admin.common.showLess')
                    : t('admin.db.showAllTables', { count: tables.length })}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  )
}

export default DatabaseSizeCard
