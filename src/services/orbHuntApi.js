import { auth } from '../config/firebase'

import { API_BASE_FOODSYNC_URL } from './const'

/**
 * Orb Hunt admin endpoints (/backoffice/orbs, ADMIN only).
 * Contract: foodsync-api/docs/orb-hunt-api.md.
 * Responses are `{ ok: true, data }` or `{ ok: false, code, error }`; errors
 * become an OrbApiError carrying the server `code` and its message.
 */
const BASE = `${API_BASE_FOODSYNC_URL}/backoffice/orbs`
const DEFAULT_TIMEOUT_MS = 25000
const EXPORT_TIMEOUT_MS = 60000

export class OrbApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'OrbApiError'
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

const call = async (
  path,
  { method = 'GET', body, query, signal, timeout = DEFAULT_TIMEOUT_MS } = {}
) => {
  const controller = new window.AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await window.fetch(`${BASE}${path}${toQuery(query)}`, {
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
      throw new OrbApiError(payload?.error || `HTTP ${res.status}`, {
        status: res.status,
        code: payload?.code || (res.status === 403 ? 'FORBIDDEN' : undefined)
      })
    }
    return payload?.data ?? payload
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new OrbApiError(
        signal?.aborted ? 'Request cancelled' : 'Request timed out',
        { code: signal?.aborted ? 'ABORTED' : 'TIMEOUT' }
      )
    }
    if (error instanceof OrbApiError) throw error
    throw new OrbApiError(error.message || 'Network error', {
      code: 'NETWORK'
    })
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export const getCampaignTemplate = ({ signal } = {}) =>
  call('/template', { signal })

export const listCampaigns = ({ signal } = {}) => call('/campaigns', { signal })

export const getCampaign = (id, { signal } = {}) =>
  call(`/campaigns/${enc(id)}`, { signal })

export const createCampaign = input =>
  call('/campaigns', { method: 'POST', body: input })

export const updateCampaign = (id, input) =>
  call(`/campaigns/${enc(id)}`, { method: 'PUT', body: input })

/** transition: 'publish' | 'end' | 'archive' */
export const changeCampaignStatus = (id, transition) =>
  call(`/campaigns/${enc(id)}/status`, {
    method: 'POST',
    body: { transition }
  })

export const duplicateCampaign = id =>
  call(`/campaigns/${enc(id)}/duplicate`, { method: 'POST', body: {} })

// ── Pins ─────────────────────────────────────────────────────────────────────

export const createPin = (campaignId, input) =>
  call(`/campaigns/${enc(campaignId)}/pins`, { method: 'POST', body: input })

export const updatePin = (pinId, input) =>
  call(`/pins/${enc(pinId)}`, { method: 'PUT', body: input })

/** Resolves `{ outcome: 'DELETED' | 'DEACTIVATED' }`. */
export const deletePin = (pinId, note) =>
  call(`/pins/${enc(pinId)}`, { method: 'DELETE', body: { note } })

// ── Reporting ────────────────────────────────────────────────────────────────

export const getOverview = (campaignId, { signal } = {}) =>
  call(`/campaigns/${enc(campaignId)}/overview`, { signal })

/** params: q, filter, platform, minFilled, sort, page, pageSize, export */
export const listParticipants = (campaignId, params = {}, { signal } = {}) =>
  call(`/campaigns/${enc(campaignId)}/participants`, {
    query: params,
    signal,
    timeout: params.export ? EXPORT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
  })

/** `user` is a userId or an e-mail address. */
export const getParticipant = (campaignId, user, { signal } = {}) =>
  call(`/campaigns/${enc(campaignId)}/participants/${enc(user)}`, { signal })

/** params: status, type, q, page, pageSize, export */
export const listPayouts = (campaignId, params = {}, { signal } = {}) =>
  call(`/campaigns/${enc(campaignId)}/payouts`, {
    query: params,
    signal,
    timeout: params.export ? EXPORT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
  })

/** params: includeReviewed, page, pageSize */
export const listFlags = (campaignId, params = {}, { signal } = {}) =>
  call(`/campaigns/${enc(campaignId)}/flags`, { query: params, signal })

export const getHeatmap = (campaignId, { signal } = {}) =>
  call(`/campaigns/${enc(campaignId)}/heatmap`, { signal })

/** params: userId, page, pageSize */
export const listAudit = (campaignId, params = {}, { signal } = {}) =>
  call(`/campaigns/${enc(campaignId)}/audit`, { query: params, signal })

// ── Support actions (all return ParticipantDetail unless noted) ─────────────

const participantPath = (campaignId, user, action) =>
  `/campaigns/${enc(campaignId)}/participants/${enc(user)}/${action}`

/** body: { kind: 'REGULAR', orbId, note } or { kind: 'SUPER', note } */
export const grantOrb = (campaignId, user, body) =>
  call(participantPath(campaignId, user, 'grant'), { method: 'POST', body })

export const revokeOrb = (userOrbId, note) =>
  call(`/userOrbs/${enc(userOrbId)}/revoke`, {
    method: 'POST',
    body: { note }
  })

export const resetProgress = (campaignId, user, note) =>
  call(participantPath(campaignId, user, 'reset'), {
    method: 'POST',
    body: { note }
  })

export const setBlocked = (campaignId, user, blocked, note) =>
  call(participantPath(campaignId, user, 'block'), {
    method: 'POST',
    body: { blocked, note }
  })

export const addNote = (campaignId, user, note) =>
  call(participantPath(campaignId, user, 'note'), {
    method: 'POST',
    body: { note }
  })

/** Resolves the Wish (FAILED, or PENDING stuck > 60 s). */
export const retryPayout = (wishId, note) =>
  call(`/wishes/${enc(wishId)}/retry`, { method: 'POST', body: { note } })

/** Resolves `{ wish, coinsTakenBack?, shortfall?, whitelist? }`. */
export const revertPayout = (wishId, note) =>
  call(`/wishes/${enc(wishId)}/revert`, { method: 'POST', body: { note } })

/** decision: 'DISMISSED' | 'BLOCKED' */
export const reviewFlag = (attemptId, decision, note) =>
  call(`/attempts/${enc(attemptId)}/review`, {
    method: 'POST',
    body: note ? { decision, note } : { decision }
  })
