import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const localePath = language =>
  new globalThis.URL(`../../locales/${language}.json`, import.meta.url)

test('all alert labels exist in each supported backoffice language', async () => {
  const locales = await Promise.all(
    ['en', 'ro', 'fr', 'es'].map(async lang =>
      JSON.parse(await readFile(localePath(lang), 'utf8'))
    )
  )
  const expected = Object.keys(locales[0].admin.alerts).sort()
  for (const locale of locales) {
    assert.deepEqual(Object.keys(locale.admin.alerts).sort(), expected)
    assert.deepEqual(
      Object.keys(locale.admin.alerts.ruleNames).sort(),
      Object.keys(locales[0].admin.alerts.ruleNames).sort()
    )
    assert.ok(locale.sidebar.alerts)
    for (const value of Object.values(locale.admin.alerts)) {
      if (typeof value === 'string') assert.ok(value.trim())
    }
  }
})

test('admin alerts requests preserve filters, UUIDs, notes and errors', async () => {
  let request
  let status = 200
  globalThis.window = {
    AbortController: globalThis.AbortController,
    URLSearchParams: globalThis.URLSearchParams,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    fetch: async (url, options) => {
      request = { url, options }
      return {
        ok: status === 200,
        status,
        json: async () =>
          status === 200
            ? { ok: true, data: { alerts: [], total: 0 } }
            : { ok: false, error: 'ALERTS_TABLE_MISSING' }
      }
    }
  }
  const original = await readFile(
    new globalThis.URL('../../services/adminApi.js', import.meta.url),
    'utf8'
  )
  const source = original
    .replace(
      "import { auth } from '../config/firebase'",
      "const auth = { currentUser: { getIdToken: async () => 'mock-token' } }"
    )
    .replace(
      "import { API_BASE_FOODSYNC_URL, API_BASE_UTILS_URL } from './const'",
      "const API_BASE_FOODSYNC_URL = 'https://mock.invalid'; const API_BASE_UTILS_URL = 'https://utils.invalid'"
    )
  const api = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  )
  try {
    await api.getAbuseAlerts({
      status: 'open',
      severity: 'critical',
      userId: 'uid/a',
      offset: 30
    })
    const url = new globalThis.URL(request.url)
    assert.equal(url.searchParams.get('userId'), 'uid/a')
    assert.equal(url.searchParams.get('offset'), '30')
    assert.equal(request.options.headers.Authorization, 'Bearer mock-token')
    const id = '00000000-0000-0000-0000-000000000001'
    await api.updateAbuseAlert(id, 'actions', {
      action: 'extend',
      hours: 24,
      note: 'Reviewed'
    })
    assert.equal(
      request.url,
      `https://mock.invalid/backoffice/alerts/${id}/actions`
    )
    assert.deepEqual(JSON.parse(request.options.body), {
      action: 'extend',
      hours: 24,
      note: 'Reviewed'
    })
    assert.equal(request.options.method, 'POST')
    await api.saveAbuseRules({ ai_overuse: { threshold: 30 } })
    assert.equal(request.options.method, 'PUT')
    status = 503
    await assert.rejects(
      api.getAbuseAlerts(),
      error => error.code === 'ALERTS_TABLE_MISSING' && error.status === 503
    )
  } finally {
    delete globalThis.window
  }
})
