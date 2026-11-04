import { useTranslation } from 'react-i18next'

const TopUsersCard = ({ rows, visibleRows, showAll, onToggle }) => {
  const { t } = useTranslation()
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          {t('pages.analytics.breakdowns.topUsers')}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {t('pages.analytics.breakdowns.events')}
          </span>
          {rows.length > 8 ? (
            <button
              type="button"
              onClick={onToggle}
              className="af-press af-focus rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700"
            >
              {showAll
                ? t('pages.analytics.breakdowns.showLess')
                : t('pages.analytics.breakdowns.showAllUsers')}
            </button>
          ) : null}
        </div>
      </div>
      <ul className="space-y-2">
        {visibleRows.map(row => (
          <li
            key={row.raw || row.userId}
            className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 transition-colors hover:bg-violet-50"
          >
            <div className="min-w-0 pr-4">
              <p className="truncate text-sm font-semibold text-slate-900">
                {t('pages.analytics.breakdowns.userId')}: {row.userId}
              </p>
              <p className="truncate text-xs text-slate-500">
                {t('pages.analytics.breakdowns.deviceId')}: {row.deviceId}
              </p>
            </div>
            <span className="af-num rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default TopUsersCard
