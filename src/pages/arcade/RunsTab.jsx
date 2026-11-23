import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getArcadeRuns } from '../../services/adminApi'
import { formatAgo, formatNumber } from '../../components/admin/format'
import { ApiError } from '../orbHunts/Modal'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  TableShell,
  Td,
  Th,
  inputClass
} from '../orbHunts/ui'
import { ARCADE_GAMES, formatDuration, gameById } from './model'

const PAGE_SIZE = 50

/** Latest runs, filterable by game and user (id or email), newest first. */
const RunsTab = ({ gameId, user, onFilter }) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [userInput, setUserInput] = useState(user)
  const [state, setState] = useState({
    runs: [],
    nextBefore: null,
    tableMissing: false,
    loading: true,
    error: null
  })

  useEffect(() => setUserInput(user), [user])

  const load = async ({ before = null, signal } = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const data = await getArcadeRuns({
        gameId: gameId || undefined,
        user: user || undefined,
        limit: PAGE_SIZE,
        before: before || undefined,
        signal
      })
      if (signal?.aborted) return
      setState(prev => ({
        runs: before ? [...prev.runs, ...data.runs] : data.runs,
        nextBefore: data.nextBefore,
        tableMissing: data.tableMissing,
        loading: false,
        error: null
      }))
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') return
      setState(prev => ({ ...prev, loading: false, error }))
    }
  }

  useEffect(() => {
    const controller = new window.AbortController()
    load({ signal: controller.signal })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user])

  const now = new Date()

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={event => {
          event.preventDefault()
          onFilter({ gameId, user: userInput.trim() })
        }}
      >
        <Field label={t('admin.arcade.runs.game')}>
          <select
            className={inputClass}
            value={gameId}
            onChange={event => onFilter({ gameId: event.target.value, user })}
          >
            <option value="">{t('admin.arcade.runs.allGames')}</option>
            {ARCADE_GAMES.map(game => (
              <option key={game.id} value={game.id}>
                {game.emoji} {t(`admin.arcade.games.${game.id}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.arcade.runs.user')} className="min-w-64 flex-1">
          <input
            className={inputClass}
            value={userInput}
            placeholder={t('admin.arcade.runs.userPlaceholder')}
            onChange={event => setUserInput(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary">
          {t('admin.arcade.runs.search')}
        </Button>
        {gameId || user ? (
          <Button
            variant="ghost"
            onClick={() => onFilter({ gameId: '', user: '' })}
          >
            {t('admin.arcade.runs.clear')}
          </Button>
        ) : null}
      </form>

      <ApiError error={state.error} />
      {state.tableMissing ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {t('admin.arcade.tableMissing')}
        </div>
      ) : null}

      {!state.loading && state.runs.length === 0 && !state.error ? (
        <EmptyState
          title={t('admin.arcade.runs.empty')}
          hint={t('admin.arcade.runs.emptyHint')}
        />
      ) : (
        <TableShell caption={t('admin.arcade.tabs.runs')}>
          <thead>
            <tr>
              <Th>{t('admin.arcade.runs.when')}</Th>
              <Th>{t('admin.arcade.players.user')}</Th>
              <Th>{t('admin.arcade.table.game')}</Th>
              <Th className="text-right">{t('admin.arcade.runs.score')}</Th>
              <Th className="text-right">{t('admin.arcade.runs.tier')}</Th>
              <Th className="text-right">{t('admin.arcade.runs.duration')}</Th>
              <Th className="text-right">{t('admin.arcade.table.coins')}</Th>
              <Th>{t('admin.arcade.runs.device')}</Th>
            </tr>
          </thead>
          <tbody>
            {state.runs.map(run => {
              const game = gameById(run.gameId)
              return (
                <tr key={`${run.userId}:${run.runId}`}>
                  <Td className="whitespace-nowrap">
                    <span title={new Date(run.createdAt).toLocaleString(lang)}>
                      {formatAgo(new Date(run.createdAt), now, lang)}
                    </span>
                    {run.wasOffline ? (
                      <Badge className="ml-2 bg-slate-100 text-slate-700 ring-slate-200">
                        {t('admin.arcade.runs.offline')}
                      </Badge>
                    ) : null}
                  </Td>
                  <Td>
                    <button
                      type="button"
                      className="af-focus rounded text-left hover:text-violet-800"
                      onClick={() =>
                        onFilter({ gameId, user: run.email || run.userId })
                      }
                    >
                      <p className="font-medium">{run.name || '—'}</p>
                      <p className="text-xs text-slate-500">
                        {run.email || run.userId}
                      </p>
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {game?.emoji} {t(`admin.arcade.games.${run.gameId}`)}
                  </Td>
                  <Td className="af-num text-right">
                    {formatNumber(Number(run.score), lang)}
                  </Td>
                  <Td className="af-num text-right">{run.tier}</Td>
                  <Td className="af-num text-right">
                    {formatDuration(run.durationMs)}
                  </Td>
                  <Td className="af-num text-right">{run.coinsAwarded}</Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">
                    {[run.platform, run.appVersion]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}

      {state.nextBefore ? (
        <div className="flex justify-center">
          <Button
            loading={state.loading}
            onClick={() => load({ before: state.nextBefore })}
          >
            {t('admin.arcade.runs.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default RunsTab
