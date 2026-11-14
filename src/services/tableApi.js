import { auth } from '../config/firebase'

import { API_BASE_FOODSYNC_URL } from './const'

/**
 * The Table admin endpoints (/backoffice/table, ADMIN only).
 * Contract: foodsync-api/docs/the-table-api.md ("Backoffice routes").
 * Responses are `{ ok: true, data }` or `{ ok: false, code, error }`; errors
 * become a TableApiError carrying the server `code` and its message.
 */
const BASE = `${API_BASE_FOODSYNC_URL}/backoffice/table`
const TIMEOUT_MS = 25000

export class TableApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'TableApiError'
    this.status = status
    this.code = code
  }
}

const authHeaders = async () => {
  const headers = { 'Content-Type': 'application/json' }
  const token = await auth.currentUser?.getIdToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const toQuery = (params = {}) => {
  const search = new window.URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

const enc = value => encodeURIComponent(String(value))

const readJson = async res => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

const call = async (path, { method = 'GET', body, query, signal } = {}) => {
  const controller = new window.AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await window.fetch(`${BASE}${path}${toQuery(query)}`, {
      method,
      headers: await authHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    })
    const payload = await readJson(res)
    if (!res.ok || payload?.ok === false) {
      throw new TableApiError(payload?.error || `HTTP ${res.status}`, {
        status: res.status,
        code: payload?.code || (res.status === 403 ? 'FORBIDDEN' : undefined)
      })
    }
    return payload?.data ?? payload
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new TableApiError(
        signal?.aborted ? 'Request cancelled' : 'Request timed out',
        { code: signal?.aborted ? 'ABORTED' : 'TIMEOUT' }
      )
    }
    if (error instanceof TableApiError) throw error
    throw new TableApiError(error.message || 'Network error', {
      code: 'NETWORK'
    })
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Optional note: sent only when non-empty. */
const noteBody = note => (note ? { note } : {})

// ── Overview ─────────────────────────────────────────────────────────────────

/** `{ openReports, hiddenAuto, pendingPhotoChecks, posts24h, activeUsers7d, friendships }` */
export const getTableSummary = ({ signal } = {}) => call('/summary', { signal })

// ── Moderation ───────────────────────────────────────────────────────────────

/** params: status ('OPEN' | 'ACTIONED' | 'DISMISSED'), cursor */
export const listReports = (params = {}, { signal } = {}) =>
  call('/reports', { query: params, signal })

/** params: status, userId, photoCheck ('PENDING'), cursor */
export const listPosts = (params = {}, { signal } = {}) =>
  call('/posts', { query: params, signal })

export const hidePost = (postId, note) =>
  call(`/posts/${enc(postId)}/hide`, { method: 'POST', body: noteBody(note) })

export const restorePost = postId =>
  call(`/posts/${enc(postId)}/restore`, { method: 'POST', body: {} })

export const dismissReport = reportId =>
  call(`/reports/${enc(reportId)}/dismiss`, { method: 'POST', body: {} })

export const banUser = (userId, note) =>
  call(`/users/${enc(userId)}/ban`, { method: 'POST', body: noteBody(note) })

export const unbanUser = userId =>
  call(`/users/${enc(userId)}/unban`, { method: 'POST', body: {} })

// ── Curated posts ────────────────────────────────────────────────────────────

export const listCurated = ({ signal } = {}) => call('/curated', { signal })

export const createCurated = input =>
  call('/curated', { method: 'POST', body: input })

export const updateCurated = (id, input) =>
  call(`/curated/${enc(id)}`, { method: 'PUT', body: input })

export const deleteCurated = id =>
  call(`/curated/${enc(id)}`, { method: 'DELETE' })
