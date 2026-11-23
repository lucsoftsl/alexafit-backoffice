import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getAppConfig,
  getArcadeOverview,
  saveAppConfig
} from '../services/adminApi'
import RefreshButton from '../components/admin/RefreshButton'
import { ApiError } from './orbHunts/Modal'
import { Tabs } from './orbHunts/ui'
import useOrbResource from './orbHunts/useOrbResource'
import { PERIODS, TAB_IDS, arcadeConfigOf } from './arcade/model'
import OverviewTab from './arcade/OverviewTab'
import PlayersTab from './arcade/PlayersTab'
import RunsTab from './arcade/RunsTab'

/**
 * Arcade minigames (ADMIN): switch the whole Arcade or single games on/off
 * (saved in App controls config, read by the apps and enforced by the API)
 * and see who plays what.
 */
const Arcade = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState('overview')
  const [days, setDays] = useState(7)
  const [runsFilter, setRunsFilter] = useState({ gameId: '', user: '' })
  const [config, setConfig] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const overview = useOrbResource(
    signal => getArcadeOverview({ days, signal }),
    `overview:${days}`
  )

  const loadConfig = useCallback(async signal => {
    try {
      const data = await getAppConfig({ signal })
      if (!signal?.aborted) setConfig(data.config)
    } catch (error) {
      if (!signal?.aborted && error.name !== 'AbortError') setSaveError(error)
    }
  }, [])

  useEffect(() => {
    const controller = new window.AbortController()
    loadConfig(controller.signal)
    return () => controller.abort()
  }, [loadConfig])

  const arcade = arcadeConfigOf(config)

  const saveArcade = async next => {
    if (!config) return
    const previous = config
    const nextConfig = { ...config, arcade: next }
    setConfig(nextConfig)
    setIsSaving(true)
    setSaveError(null)
    try {
      const data = await saveAppConfig(nextConfig)
      setConfig(data.config)
    } catch (error) {
      setConfig(previous)
      setSaveError(error)
    } finally {
      setIsSaving(false)
    }
  }

  const openRuns = filter => {
    setRunsFilter({ gameId: '', user: '', ...filter })
    setTab('runs')
  }

  const tabs = TAB_IDS.map(id => ({ id, label: t(`admin.arcade.tabs.${id}`) }))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t('admin.arcade.title')}</h1>
          <p className="mt-1 text-gray-600">{t('admin.arcade.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            role="radiogroup"
            aria-label={t('admin.arcade.period')}
            className="inline-flex rounded-full border border-slate-200 bg-white p-1"
          >
            {PERIODS.map(value => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={days === value}
                onClick={() => setDays(value)}
                className={`af-focus rounded-full px-3 py-1 text-sm font-medium ${
                  days === value
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t('admin.arcade.days', { count: value })}
              </button>
            ))}
          </div>
          <RefreshButton
            onClick={overview.reload}
            loading={overview.loading}
            label={t('admin.arcade.refresh')}
          />
        </div>
      </header>

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        label={t('admin.arcade.title')}
      />

      <ApiError error={saveError} />
      <ApiError error={overview.error} />

      {tab === 'overview' ? (
        <OverviewTab
          data={overview.data}
          loading={overview.loading}
          days={days}
          arcade={arcade}
          isSaving={isSaving || !config}
          onToggleArcade={enabled => saveArcade({ ...arcade, enabled })}
          onToggleGame={(gameId, value) =>
            saveArcade({
              ...arcade,
              games: { ...arcade.games, [gameId]: value }
            })
          }
          onOpenRuns={gameId => openRuns({ gameId })}
        />
      ) : null}
      {tab === 'players' ? (
        <PlayersTab
          players={overview.data?.topPlayers}
          loading={overview.loading}
          onOpenRuns={user => openRuns({ user })}
        />
      ) : null}
      {tab === 'runs' ? (
        <RunsTab
          gameId={runsFilter.gameId}
          user={runsFilter.user}
          onFilter={setRunsFilter}
        />
      ) : null}
    </div>
  )
}

export default Arcade
