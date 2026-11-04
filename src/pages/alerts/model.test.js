import assert from 'node:assert/strict'
import test from 'node:test'

import { alertDetails, openAlertCount, parseRules } from './model.js'

test('badge counts open warning and critical alerts only', () => {
  assert.equal(openAlertCount({ openWarning: 3, openCritical: 2 }), 5)
  assert.equal(openAlertCount(null), 0)
})

test('rules editor accepts bounded rules and rejects unsafe input', () => {
  const rules = {
    ai_overuse: {
      enabled: true,
      threshold: 30,
      windowHours: 1,
      action: 'throttle'
    }
  }
  assert.deepEqual(parseRules(JSON.stringify(rules)), rules)
  for (const value of [
    '[]',
    'null',
    '{"x":{"threshold":-1}}',
    '{"x":{"enabled":"true","threshold":30}}'
  ]) {
    assert.throws(() => parseRules(value))
  }
})

test('alert detail parses only supported scalar fields and tolerates malformed JSON', () => {
  assert.deepEqual(
    alertDetails('{"total":31,"threshold":30,"private":"ignore"}'),
    [
      ['total', 31],
      ['threshold', 30]
    ]
  )
  assert.deepEqual(alertDetails({ percent: 91 }), [['percent', 91]])
  assert.deepEqual(alertDetails('{broken'), [])
  assert.deepEqual(alertDetails({ total: { nested: true } }), [])
})
