// Arcade minigames shown in the backoffice. Ids match foodsync-api
// ARCADE_GAME_IDS and the app's catalog.ts; colours are only for charts.
export const ARCADE_GAMES = [
  { id: 'higherLower', emoji: '↕️', color: '#5B3ADB' },
  { id: 'nutriScore', emoji: '🅰️', color: '#038141' },
  { id: 'foodWord', emoji: '🔤', color: '#FF7A1A' },
  { id: 'plateBuilder', emoji: '🍽️', color: '#2F80ED' },
  { id: 'sortIt', emoji: '🫘', color: '#EC5B82' },
  { id: 'marketDash', emoji: '🧺', color: '#14B3AC' },
  { id: 'fridgeMemory', emoji: '🧊', color: '#4F55D8' },
  { id: 'harvestGarden', emoji: '🥕', color: '#28A46B' },
  { id: 'repChallenge', emoji: '🏋️', color: '#F5B400' }
]

export const GAME_IDS = ARCADE_GAMES.map(game => game.id)

export const gameById = id => ARCADE_GAMES.find(game => game.id === id)

export const TAB_IDS = ['overview', 'players', 'runs']

export const PERIODS = [1, 7, 30, 90]

/** Server default is "everything on"; older saved configs may lack `arcade`. */
export const arcadeConfigOf = config => ({
  enabled: config?.arcade?.enabled !== false,
  games: Object.fromEntries(
    GAME_IDS.map(id => [id, config?.arcade?.games?.[id] !== false])
  )
})

/**
 * Rows of { day, [gameId]: runs } for a stacked chart, one row per day in
 * the window (days without runs get zeros so the axis has no gaps).
 */
export const dailySeries = (daily = [], days, today = new Date()) => {
  const rows = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today.getTime() - i * 86_400_000)
    const day = date.toISOString().slice(0, 10)
    rows.push({ day, ...Object.fromEntries(GAME_IDS.map(id => [id, 0])) })
  }
  const byDay = new Map(rows.map(row => [row.day, row]))
  for (const entry of daily) {
    const row = byDay.get(String(entry.day).slice(0, 10))
    if (row && entry.gameId in row) row[entry.gameId] = Number(entry.runs) || 0
  }
  return rows
}

export const formatDuration = ms => {
  const value = Number(ms)
  if (!Number.isFinite(value) || value <= 0) return '—'
  const seconds = Math.round(value / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}
