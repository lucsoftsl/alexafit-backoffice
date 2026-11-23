import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import StatTile from '../../components/admin/StatTile'
import {
  axisProps,
  gridProps,
  tooltipProps
} from '../../components/admin/chartTheme'
import { formatNumber } from '../../components/admin/format'
import { Card, EmptyState, TableShell, Td, Th, Toggle } from '../orbHunts/ui'
import { ARCADE_GAMES, dailySeries, formatDuration } from './model'

const numberOrNull = value =>
  value === null || value === undefined ? null : Number(value)

/**
 * Switches (master + one per game) next to each game's numbers for the
 * selected period, plus runs per day.
 */
const OverviewTab = ({
  data,
  loading,
  days,
  arcade,
  isSaving,
  onToggleArcade,
  onToggleGame,
  onOpenRuns
}) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const perGame = new Map((data?.perGame || []).map(row => [row.gameId, row]))
  const totals = data?.totals || {}
  const series = dailySeries(data?.daily, days)
  const gameName = id => t(`admin.arcade.games.${id}`)

  return (
    <div className="space-y-6">
      {data?.tableMissing ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {t('admin.arcade.tableMissing')}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label={t('admin.arcade.stats.runs')}
          value={numberOrNull(totals.runs)}
          loading={loading}
        />
        <StatTile
          label={t('admin.arcade.stats.players')}
          value={numberOrNull(totals.players)}
          loading={loading}
        />
        <StatTile
          label={t('admin.arcade.stats.coins')}
          value={numberOrNull(totals.ledgerCoins)}
          loading={loading}
          hint={t('admin.arcade.stats.coinsHint')}
        />
        <StatTile
          label={t('admin.arcade.stats.gamesOn')}
          value={
            arcade.enabled
              ? ARCADE_GAMES.filter(game => arcade.games[game.id]).length
              : 0
          }
          hint={t('admin.arcade.stats.gamesOnHint', {
            total: ARCADE_GAMES.length
          })}
        />
      </div>

      <Card
        eyebrow={t('admin.arcade.switches.eyebrow')}
        title={t('admin.arcade.switches.title')}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {arcade.enabled
                ? t('admin.arcade.switches.on')
                : t('admin.arcade.switches.off')}
            </span>
            <Toggle
              checked={arcade.enabled}
              disabled={isSaving}
              onChange={onToggleArcade}
              label={t('admin.arcade.switches.master')}
            />
          </div>
        }
      >
        <p className="mb-4 text-sm text-slate-600">
          {t('admin.arcade.switches.help')}
        </p>
        <TableShell caption={t('admin.arcade.switches.title')}>
          <thead>
            <tr>
              <Th>{t('admin.arcade.table.game')}</Th>
              <Th>{t('admin.arcade.table.on')}</Th>
              <Th className="text-right">{t('admin.arcade.table.runs')}</Th>
              <Th className="text-right">{t('admin.arcade.table.players')}</Th>
              <Th className="text-right">{t('admin.arcade.table.avgScore')}</Th>
              <Th className="text-right">
                {t('admin.arcade.table.bestScore')}
              </Th>
              <Th className="text-right">
                {t('admin.arcade.table.avgDuration')}
              </Th>
              <Th className="text-right">{t('admin.arcade.table.coins')}</Th>
              <Th className="text-right">{t('admin.arcade.table.offline')}</Th>
            </tr>
          </thead>
          <tbody>
            {ARCADE_GAMES.map(game => {
              const row = perGame.get(game.id)
              const on = arcade.enabled && arcade.games[game.id]
              return (
                <tr
                  key={game.id}
                  className={on ? undefined : 'bg-slate-50 text-slate-500'}
                >
                  <Td>
                    <button
                      type="button"
                      className="af-focus inline-flex items-center gap-2 rounded font-medium hover:text-violet-800"
                      onClick={() => onOpenRuns(game.id)}
                      title={t('admin.arcade.table.openRuns')}
                    >
                      <span aria-hidden="true">{game.emoji}</span>
                      {gameName(game.id)}
                    </button>
                  </Td>
                  <Td>
                    <Toggle
                      checked={arcade.games[game.id]}
                      disabled={isSaving || !arcade.enabled}
                      onChange={value => onToggleGame(game.id, value)}
                      label={t('admin.arcade.table.toggle', {
                        game: gameName(game.id)
                      })}
                    />
                  </Td>
                  <Td className="af-num text-right">
                    {formatNumber(row?.runs ?? 0, lang)}
                  </Td>
                  <Td className="af-num text-right">
                    {formatNumber(row?.players ?? 0, lang)}
                  </Td>
                  <Td className="af-num text-right">
                    {row ? formatNumber(Math.round(row.avgScore), lang) : '—'}
                  </Td>
                  <Td className="af-num text-right">
                    {row ? formatNumber(row.maxScore, lang) : '—'}
                  </Td>
                  <Td className="af-num text-right">
                    {row ? formatDuration(row.avgDurationMs) : '—'}
                  </Td>
                  <Td className="af-num text-right">
                    {formatNumber(row?.coins ?? 0, lang)}
                  </Td>
                  <Td className="af-num text-right">
                    {formatNumber(row?.offlineRuns ?? 0, lang)}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      </Card>

      <Card
        eyebrow={t('admin.arcade.chart.eyebrow')}
        title={t('admin.arcade.chart.title')}
      >
        {!loading && !(totals.runs > 0) ? (
          <EmptyState
            title={t('admin.arcade.chart.empty')}
            hint={t('admin.arcade.chart.emptyHint')}
          />
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart
                data={series}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="day"
                  {...axisProps}
                  tickFormatter={day => day.slice(5)}
                />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip
                  {...tooltipProps}
                  formatter={(value, key) => [
                    formatNumber(value, lang),
                    gameName(key)
                  ]}
                />
                <Legend formatter={key => gameName(key)} />
                {ARCADE_GAMES.map(game => (
                  <Bar
                    key={game.id}
                    dataKey={game.id}
                    stackId="runs"
                    fill={game.color}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}

export default OverviewTab
