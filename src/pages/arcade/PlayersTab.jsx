import { useTranslation } from 'react-i18next'

import { formatAgo, formatNumber } from '../../components/admin/format'
import { EmptyState, TableShell, Td, Th } from '../orbHunts/ui'

/** Most active players in the period (from the overview payload). */
const PlayersTab = ({ players = [], loading, onOpenRuns }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const now = new Date()

  if (!loading && players.length === 0) {
    return (
      <EmptyState
        title={t('admin.arcade.players.empty')}
        hint={t('admin.arcade.players.emptyHint')}
      />
    )
  }

  return (
    <TableShell caption={t('admin.arcade.tabs.players')}>
      <thead>
        <tr>
          <Th>{t('admin.arcade.players.user')}</Th>
          <Th className="text-right">{t('admin.arcade.table.runs')}</Th>
          <Th className="text-right">{t('admin.arcade.players.games')}</Th>
          <Th className="text-right">{t('admin.arcade.table.coins')}</Th>
          <Th>{t('admin.arcade.players.lastPlayed')}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {players.map(player => (
          <tr key={player.userId}>
            <Td>
              <p className="font-medium">{player.name || '—'}</p>
              <p className="text-xs text-slate-500">
                {player.email || player.userId}
              </p>
            </Td>
            <Td className="af-num text-right">
              {formatNumber(player.runs, lang)}
            </Td>
            <Td className="af-num text-right">
              {formatNumber(player.games, lang)}
            </Td>
            <Td className="af-num text-right">
              {formatNumber(player.coins ?? 0, lang)}
            </Td>
            <Td>
              {player.lastPlayedAt
                ? formatAgo(new Date(player.lastPlayedAt), now, lang)
                : '—'}
            </Td>
            <Td className="text-right">
              <button
                type="button"
                className="af-focus rounded text-sm font-medium text-violet-700 hover:text-violet-900"
                onClick={() => onOpenRuns(player.email || player.userId)}
              >
                {t('admin.arcade.players.viewRuns')}
              </button>
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

export default PlayersTab
