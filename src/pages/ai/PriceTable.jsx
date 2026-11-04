import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Panel from '../../components/admin/Panel'
import { formatCompact, formatUsd } from '../../components/admin/format'

const COLLAPSED_ROWS = 12

/** Gemini prices (LiteLLM list), models in use pinned to the top. */
const PriceTable = ({
  prices,
  inUse,
  fetchedAt,
  error,
  source,
  googlePricing,
  onRefresh,
  refreshing
}) => {
  const { t, i18n } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const rows = useMemo(
    () =>
      [...(prices || [])].sort(
        (a, b) => Number(inUse.has(b.model)) - Number(inUse.has(a.model))
      ),
    [prices, inUse]
  )
  const visible = showAll ? rows : rows.slice(0, COLLAPSED_ROWS)

  return (
    <Panel
      subtitle={t('admin.ai.pricesHint')}
      onRefresh={onRefresh}
      refreshing={refreshing}
      refreshLabel={t('admin.ai.refreshPrices')}
      updatedAt={fetchedAt}
      actions={
        <a
          href={googlePricing}
          target="_blank"
          rel="noreferrer"
          className="af-underline af-focus text-xs font-semibold text-violet-700"
        >
          {t('admin.ai.googlePricing')}
        </a>
      }
    >
      {error ? (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('admin.ai.pricesError')}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t('admin.ai.noPrices')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">{t('admin.ai.prices')}</caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <th scope="col" className="py-2 pr-4">
                  {t('admin.ai.model')}
                </th>
                <th scope="col" className="py-2 pr-4 text-right">
                  {t('admin.ai.inputPerM')}
                </th>
                <th scope="col" className="py-2 pr-4 text-right">
                  {t('admin.ai.outputPerM')}
                </th>
                <th scope="col" className="py-2 pr-4 text-right">
                  {t('admin.ai.context')}
                </th>
                <th scope="col" className="py-2 text-right">
                  {t('admin.ai.retires')}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => {
                const used = inUse.has(row.model)
                return (
                  <tr
                    key={row.model}
                    className={`border-b border-slate-100 transition-colors hover:bg-violet-50/60 ${
                      used ? 'bg-violet-50/40' : ''
                    }`}
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-slate-800">
                      {row.model}
                      {used ? (
                        <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-white">
                          {t('admin.ai.inUse')}
                        </span>
                      ) : null}
                    </td>
                    <td className="af-num py-2 pr-4 text-right">
                      {formatUsd(row.input, i18n.language)}
                    </td>
                    <td className="af-num py-2 pr-4 text-right">
                      {formatUsd(row.output, i18n.language)}
                    </td>
                    <td className="af-num py-2 pr-4 text-right text-slate-500">
                      {row.contextTokens
                        ? formatCompact(row.contextTokens, i18n.language)
                        : '—'}
                    </td>
                    <td className="py-2 text-right text-xs text-slate-500">
                      {row.retires || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <a
          href={source}
          target="_blank"
          rel="noreferrer"
          className="af-underline af-focus"
        >
          {t('admin.ai.pricesSource')}
        </a>
        {rows.length > COLLAPSED_ROWS ? (
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="af-underline af-focus font-semibold text-violet-700"
          >
            {showAll
              ? t('admin.common.showLess')
              : t('admin.ai.showAllModels', { count: rows.length })}
          </button>
        ) : null}
      </div>
    </Panel>
  )
}

export default PriceTable
