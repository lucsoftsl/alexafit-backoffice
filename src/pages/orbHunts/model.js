/**
 * Orb Hunt admin: constants mirrored from foodsync-api/utils/orbs.constants.js
 * (the server re-validates everything) and pure helpers.
 */

export const LANGUAGES = ['en', 'ro', 'es', 'fr', 'hu', 'pt', 'ja', 'th']
export const SOURCE_TYPES = ['STEPS', 'ACTIVE_DAYS', 'STREAK', 'EXPLORE']
export const WISH_TYPES = ['COINS', 'PREMIUM_DAYS']
export const WISH_STATUSES = ['PENDING', 'GRANTED', 'FAILED', 'REVERTED']
export const SLOT_LIMITS = { min: 1, max: 12 }
export const WISH_OPTION_LIMITS = { min: 1, max: 4 }
export const MAX_CAMPAIGN_DAYS = 120
export const NOTE_MIN = 3
export const NOTE_MAX = 1000
export const PIN_RADIUS = [1, 50000]
export const TITLE_MAX = 120
export const DESCRIPTION_MAX = 1000
export const WISH_TEXT_MAX = 300
export const SLOT_NAME_MAX = 60
export const PIN_NAME_MAX = 200

export const SLOT_CONFIG_FIELDS = {
  STEPS: [{ key: 'steps', bounds: [1, 100000], required: true }],
  ACTIVE_DAYS: [
    { key: 'days', bounds: [1, 120], required: true },
    { key: 'windowDays', bounds: [1, 120], required: true }
  ],
  STREAK: [{ key: 'days', bounds: [1, 365], required: true }],
  EXPLORE: [
    { key: 'minDistanceM', bounds: [1, 10000], required: false },
    { key: 'maxDistanceM', bounds: [1, 10000], required: false }
  ]
}

export const DEFAULT_SLOT_CONFIG = {
  STEPS: { steps: 8000 },
  ACTIVE_DAYS: { days: 3, windowDays: 7 },
  STREAK: { days: 5 },
  EXPLORE: {}
}

/** Grouped numeric/boolean settings with the server bounds. */
export const SETTINGS_GROUPS = [
  {
    key: 'superOrb',
    fields: [
      { key: 'enabled', type: 'bool' },
      { key: 'minMeals', bounds: [1, 6] },
      { key: 'minDayKcal', bounds: [0, 10000] },
      { key: 'requireExercise', type: 'bool' },
      { key: 'requireCheckIn', type: 'bool' },
      { key: 'checkInWindowDays', bounds: [1, 365] },
      { key: 'maxPerCampaign', bounds: [0, 100] },
      { key: 'maxPerWeek', bounds: [1, 7] }
    ]
  },
  {
    key: 'activity',
    fields: [{ key: 'minSyncedActiveKcal', bounds: [0, 10000] }]
  },
  {
    key: 'steps',
    fields: [{ key: 'maxPlausibleSteps', bounds: [1000, 1000000] }]
  },
  {
    key: 'explore',
    fields: [
      { key: 'enabled', type: 'bool' },
      { key: 'minDistanceM', bounds: [1, 10000] },
      { key: 'maxDistanceM', bounds: [1, 10000] },
      { key: 'catchRadiusM', bounds: [1, 1000] },
      { key: 'spawnTtlHours', bounds: [1, 720] },
      { key: 'maxSpawnsPerDay', bounds: [1, 100] },
      { key: 'maxSpeedMps', bounds: [1, 100] },
      { key: 'minStepsRatio', bounds: [0, 1], step: 0.05 },
      { key: 'maxAccuracyM', bounds: [1, 1000] }
    ]
  },
  {
    key: 'pins',
    fields: [
      { key: 'searchRadiusKm', bounds: [1, 20000] },
      { key: 'maxPerDay', bounds: [1, 100] }
    ]
  },
  {
    key: 'wish',
    fields: [
      { key: 'maxWildcards', bounds: [0, 12] },
      { key: 'graceDays', bounds: [0, 365] }
    ]
  }
]

export const WISH_AMOUNT_BOUNDS = { COINS: [1, 1000], PREMIUM_DAYS: [1, 90] }

/** Tailwind classes per campaign status: LIVE green, DRAFT grey, ENDED slate. */
export const CAMPAIGN_STATUS_STYLE = {
  LIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
  DRAFT: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  ENDED: 'bg-slate-200 text-slate-700 ring-slate-500/25',
  ARCHIVED: 'bg-white text-slate-500 ring-slate-300'
}

export const WISH_STATUS_STYLE = {
  PENDING: 'bg-sky-50 text-sky-800 ring-sky-600/25',
  GRANTED: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
  FAILED: 'bg-rose-50 text-rose-800 ring-rose-600/25',
  REVERTED: 'bg-slate-100 text-slate-700 ring-slate-500/25'
}

export const ATTEMPT_RESULT_STYLE = {
  OK: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
  REJECTED: 'bg-slate-100 text-slate-700 ring-slate-500/25'
}

export const FLAG_STYLE = 'bg-amber-50 text-amber-800 ring-amber-600/30'

/** Allowed transitions per status (mirrors the server TRANSITIONS table). */
export const TRANSITIONS = {
  DRAFT: ['publish', 'archive'],
  LIVE: ['end'],
  ENDED: ['publish', 'archive'],
  ARCHIVED: []
}

/** Reasons that land in the fraud queue (amber). */
export const FLAGGED_REASONS = new Set([
  'STEPS_IMPLAUSIBLE',
  'MOCK_LOCATION',
  'TOO_FAST',
  'IMPOSSIBLE_TRAVEL'
])

/** PENDING payouts older than this can be retried (stuck payout). */
export const STUCK_PENDING_MS = 60 * 1000

/** Retry is allowed for FAILED wishes and for PENDING ones stuck > 60 s. */
export const canRetryWish = (wish, now = Date.now()) => {
  if (!wish) return false
  if (wish.status === 'FAILED') return true
  if (wish.status !== 'PENDING') return false
  const created = new Date(wish.createdAt).getTime()
  return Number.isFinite(created) && now - created > STUCK_PENDING_MS
}

export const campaignTitle = (campaign, lang = 'en') =>
  campaign?.content?.[lang]?.title || campaign?.content?.en?.title || '—'

export const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value))

export const formatDate = (value, locale) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
}

export const formatDateTime = (value, locale) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
}

const pad = n => String(n).padStart(2, '0')

/** ISO → value for <input type="datetime-local"> (local time). */
export const toLocalInput = value => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value → ISO, or null when empty/invalid. */
export const fromLocalInput = value => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Keys that could carry raw coordinates; stripped before display. */
const COORD_KEYS = new Set([
  'lat',
  'lng',
  'lon',
  'latitude',
  'longitude',
  'originLat',
  'originLng',
  'position'
])

/** Deep copy without coordinate fields (privacy: never show user GPS). */
export const withoutCoordinates = value => {
  if (Array.isArray(value)) return value.map(withoutCoordinates)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !COORD_KEYS.has(key))
        .map(([key, v]) => [key, withoutCoordinates(v)])
    )
  }
  return value
}

export const prettyJson = value => {
  if (value === null || value === undefined) return '—'
  try {
    return JSON.stringify(withoutCoordinates(value), null, 2)
  } catch {
    return String(value)
  }
}

/** Server validation errors arrive joined by "; ". */
export const splitMessages = message =>
  String(message || '')
    .split('; ')
    .map(s => s.trim())
    .filter(Boolean)

/**
 * Error codes with a translated explanation under admin.orbHunt.errors.
 * Anything else falls back to the server message.
 */
const KNOWN_ERRORS = new Set([
  'ANOTHER_LIVE',
  'CAMPAIGN_OVER',
  'CAMPAIGN_ARCHIVED',
  'CAMPAIGN_NOT_FOUND',
  'SLOT_IN_USE',
  'INVALID_TRANSITION',
  'NOTE_REQUIRED',
  'USER_NOT_FOUND',
  'ORB_NOT_FOUND',
  'ALREADY_COLLECTED',
  'ALREADY_REVOKED',
  'WISH_GRANTED',
  'WISH_NOT_GRANTED',
  'WISH_NOT_FAILED',
  'WISH_NOT_FOUND',
  'INSUFFICIENT_FUNDS',
  'PIN_NOT_FOUND',
  'TIMEOUT',
  'NETWORK',
  'FORBIDDEN'
])

/** `t` is i18next's t. Returns a friendly one-line error message. */
export const errorMessage = (t, error) => {
  if (!error) return ''
  const code = error.code
  if (code && KNOWN_ERRORS.has(code)) {
    return t(`admin.orbHunt.errors.${code}`)
  }
  if (code === 'INVALID_CAMPAIGN' || code === 'INVALID_PIN') {
    return t('admin.orbHunt.errors.INVALID')
  }
  return error.message || t('admin.orbHunt.errors.generic')
}

/** For INVALID_CAMPAIGN / INVALID_PIN: the individual server messages. */
export const errorDetails = error =>
  error?.code === 'INVALID_CAMPAIGN' || error?.code === 'INVALID_PIN'
    ? splitMessages(error.message)
    : []
