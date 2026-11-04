import { auth } from '../config/firebase'

import { API_BASE_FOODSYNC_URL, API_BASE_UTILS_URL } from './const'

/**
 * Admin-only endpoints (Admin › AI, Analytics overview, database sizes).
 * Unlike loggedinApi's helpers, errors keep the server's `error` code
 * (e.g. SETTINGS_TABLE_MISSING) so the UI can explain what to do.
 */
const DEFAULT_TIMEOUT_MS = 20000

export class AdminApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const authHeaders = async () => {
  const headers = { 'Content-Type': 'application/json' }
  const token = await auth.currentUser?.getIdToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const call = async (
  url,
  { method = 'GET', body, timeout = DEFAULT_TIMEOUT_MS, signal } = {}
) => {
  const controller = new window.AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await window.fetch(url, {
      method,
      headers: await authHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    })
    let payload = null
    try {
      payload = await res.json()
    } catch {
      payload = null
    }
    if (!res.ok || payload?.ok === false) {
      throw new AdminApiError(payload?.error || `HTTP ${res.status}`, {
        status: res.status,
        code: payload?.error,
        details: payload?.details
      })
    }
    return payload?.data ?? payload
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AdminApiError('Request timed out', { code: 'TIMEOUT' })
    }
    throw error
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

const api = path => `${API_BASE_FOODSYNC_URL}${path}`
const refreshQuery = refresh => (refresh ? '?refresh=1' : '')

export const getAiSettings = ({ refresh = false, signal } = {}) =>
  call(api(`/backoffice/ai/settings${refreshQuery(refresh)}`), { signal })

export const saveAiSettings = settings =>
  call(api('/backoffice/ai/settings'), { method: 'PUT', body: settings })

export const getAiUsage = ({ from, to, signal } = {}) => {
  const params = new window.URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return call(api(`/backoffice/ai/usage?${params.toString()}`), { signal })
}

export const testAiModel = ({ provider, model }) =>
  call(api('/backoffice/ai/test'), {
    method: 'POST',
    body: { provider, model },
    timeout: 40000
  })

export const getRapidApiModels = ({ signal } = {}) =>
  call(api('/backoffice/ai/rapidapi-models'), { signal })

/** Uses one request on the RapidAPI plan: only on an explicit admin click. */
export const refreshRapidApiModels = () =>
  call(api('/backoffice/ai/rapidapi-models/refresh'), {
    method: 'POST',
    body: {},
    timeout: 30000
  })

export const getAzureDbSize = ({ refresh = false, signal } = {}) =>
  refresh
    ? call(api('/backoffice/analytics/database-size/refresh'), {
        method: 'POST',
        body: {},
        timeout: 40000
      })
    : call(api('/backoffice/analytics/database-size'), {
        signal,
        timeout: 40000
      })

export const getTidbDbSize = ({ refresh = false, signal } = {}) =>
  call(
    `${API_BASE_UTILS_URL}/admin/database-size/alexafit${refreshQuery(refresh)}`,
    { signal, timeout: 40000 }
  )

export const getAdminOverview = ({ refresh = false, signal } = {}) =>
  call(api(`/backoffice/analytics/overview${refreshQuery(refresh)}`), {
    signal,
    timeout: 40000
  })

// ── Admin › AI: usage by user, per-user limits, plan limits ──

const query = params => {
  const search = new window.URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const getAiUsageByUsers = ({
  from,
  to,
  search,
  sort,
  direction,
  limit,
  offset,
  signal
} = {}) =>
  call(
    api(
      `/backoffice/ai/usage/users${query({ from, to, search, sort, direction, limit, offset })}`
    ),
    { signal }
  )

export const getAiUserUsage = (userId, { from, to, signal } = {}) =>
  call(
    api(
      `/backoffice/ai/usage/users/${encodeURIComponent(userId)}${query({ from, to })}`
    ),
    { signal }
  )

export const getAiUserLimits = (userId, { signal } = {}) =>
  call(api(`/backoffice/ai/limits/users/${encodeURIComponent(userId)}`), {
    signal
  })

/** body: { overrides, clearAuto?, convertAuto? } or { reset: true }. */
export const saveAiUserLimits = (userId, body) =>
  call(api(`/backoffice/ai/limits/users/${encodeURIComponent(userId)}`), {
    method: 'PUT',
    body
  })

export const getTierLimits = ({ signal } = {}) =>
  call(api('/backoffice/ai/tier-limits'), { signal })

export const saveTierLimits = tierLimits =>
  call(api('/backoffice/ai/tier-limits'), { method: 'PUT', body: tierLimits })

export const getAbuseAlerts = ({ signal, ...filters } = {}) =>
  call(api(`/backoffice/alerts${query(filters)}`), { signal })
export const getAlertsSummary = () => call(api('/backoffice/alerts/summary'))
export const getAbuseRules = () => call(api('/backoffice/alerts/rules'))
export const saveAbuseRules = rules =>
  call(api('/backoffice/alerts/rules'), { method: 'PUT', body: rules })
export const updateAbuseAlert = (id, operation, body) =>
  call(api(`/backoffice/alerts/${encodeURIComponent(id)}/${operation}`), {
    method: 'POST',
    body
  })
export const getAnalyticsInsights = ({ signal } = {}) =>
  call(`${API_BASE_UTILS_URL}/admin/analytics-insights/alexafit`, { signal })
