/** Shared constants and pure helpers for The Table admin page. */

export const TAB_IDS = ['overview', 'reports', 'posts', 'curated']
export const DEFAULT_TAB = 'reports'

export const REPORT_STATUSES = ['OPEN', 'ACTIONED', 'DISMISSED']
export const POST_STATUSES = [
  'VISIBLE',
  'HIDDEN_AUTO',
  'HIDDEN_ADMIN',
  'DELETED'
]
export const HIDDEN_STATUSES = new Set(['HIDDEN_AUTO', 'HIDDEN_ADMIN'])

/** Types an admin may use for curated posts. */
export const CURATED_TYPES = [
  'CURATED',
  'MEAL_LOGGED',
  'FOOD_CREATED',
  'RECIPE_CREATED'
]
export const CURATED_LANGS = ['en', 'ro', 'es', 'fr', 'hu', 'pt', 'ja', 'th']

export const CURATED_LIMITS = {
  title: 80,
  body: 500,
  ctaLabel: 40,
  ctaTarget: 200,
  sortOrder: [0, 9999]
}

/** Starting snapshot when a FOOD type is picked in the curated editor. */
export const PAYLOAD_TEMPLATES = {
  MEAL_LOGGED: {
    mealType: 'LUNCH',
    items: [{ name: '', quantity: 100, unit: 'g', kcal: 0 }],
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  },
  FOOD_CREATED: {
    itemId: '',
    name: '',
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: 100,
    servingUnit: 'g'
  },
  RECIPE_CREATED: {
    itemId: '',
    name: '',
    kcalPerServing: 0,
    servings: 1,
    ingredients: [{ name: '', quantity: 100, unit: 'g' }]
  }
}

export const POST_STATUS_STYLE = {
  VISIBLE: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
  HIDDEN_AUTO: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  HIDDEN_ADMIN: 'bg-rose-50 text-rose-800 ring-rose-600/30',
  DELETED: 'bg-slate-100 text-slate-600 ring-slate-500/30'
}

export const REASON_STYLE = {
  NUDITY: 'bg-rose-50 text-rose-800 ring-rose-600/30',
  SELF_HARM: 'bg-rose-50 text-rose-800 ring-rose-600/30',
  HATE: 'bg-rose-50 text-rose-800 ring-rose-600/30',
  HARASSMENT: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  SPAM: 'bg-slate-100 text-slate-700 ring-slate-500/30',
  OTHER: 'bg-slate-100 text-slate-700 ring-slate-500/30'
}

export const GROUP_STYLE = {
  FOOD: 'bg-lime-50 text-lime-800 ring-lime-600/30',
  EXERCISE: 'bg-sky-50 text-sky-800 ring-sky-600/30',
  PROGRESS: 'bg-violet-50 text-violet-800 ring-violet-600/30',
  FUN: 'bg-pink-50 text-pink-800 ring-pink-600/30'
}

/** Moderation SLA (Apple guideline 1.2: act on reports within 24 h). */
export const REPORT_SLA_MS = 24 * 60 * 60 * 1000

export const isOverdue = (createdAt, now = Date.now()) => {
  const time = new Date(createdAt).getTime()
  return Number.isFinite(time) && now - time > REPORT_SLA_MS
}

const num = value =>
  Number.isFinite(Number(value)) ? Math.round(Number(value)) : '—'

/**
 * Interpolation values for `admin.theTable.payload.<TYPE>`; every type has a
 * one-line summary string in the locales. Unknown fields render as "—".
 */
export const payloadParams = (type, payload = {}) => {
  const p = payload || {}
  switch (type) {
    case 'MEAL_LOGGED':
      return {
        mealType: p.mealType || '—',
        count: Array.isArray(p.items) ? p.items.length : 0,
        kcal: num(p.kcal),
        protein: num(p.protein),
        carbs: num(p.carbs),
        fat: num(p.fat)
      }
    case 'FOOD_CREATED':
      return {
        name: p.name || '—',
        kcal: num(p.kcal),
        serving: `${p.servingSize ?? '—'} ${p.servingUnit || ''}`.trim()
      }
    case 'RECIPE_CREATED':
      return {
        name: p.name || '—',
        kcal: num(p.kcalPerServing),
        servings: num(p.servings)
      }
    case 'EXERCISE_LOGGED':
    case 'EXERCISE_CREATED':
      return { name: p.name || '—', minutes: num(p.minutes), kcal: num(p.kcal) }
    case 'WEIGHT_MILESTONE':
      return {
        display: p.display || 'NONE',
        delta:
          p.display === 'PERCENT'
            ? `${p.deltaPercent ?? '—'}%`
            : p.display === 'UNITS'
              ? `${p.delta ?? '—'} ${p.unit || ''}`.trim()
              : '—',
        goal: p.reachedGoal ? '✓' : '—'
      }
    case 'GAME_RESULT':
      return {
        mode: p.mode || '—',
        score: num(p.score),
        result: p.won === true ? 'W' : p.won === false ? 'L' : '—',
        opponent: p.opponentName || '—'
      }
    default:
      return Object.fromEntries(
        Object.entries(p).map(([key, value]) => [
          key,
          value === null || value === undefined || typeof value === 'object'
            ? '—'
            : String(value)
        ])
      )
  }
}

export const shortId = id => (id ? `${String(id).slice(0, 8)}…` : '—')

/** Trimmed string, or null when empty. */
export const orNull = value => {
  const text = typeof value === 'string' ? value.trim() : value
  return text === '' || text === undefined ? null : text
}

/** Broadcast so the nav badge refreshes right after a moderation action. */
export const REPORTS_CHANGED_EVENT = 'af:table-reports-changed'
export const notifyReportsChanged = () =>
  window.dispatchEvent(new window.Event(REPORTS_CHANGED_EVENT))
