export const openAlertCount = summary =>
  Math.max(0, Number(summary?.openWarning) || 0) +
  Math.max(0, Number(summary?.openCritical) || 0)

export const parseRules = text => {
  const rules = JSON.parse(text)
  if (!rules || Array.isArray(rules) || typeof rules !== 'object')
    throw new Error('INVALID_RULES')
  for (const rule of Object.values(rules)) {
    if (
      !rule ||
      typeof rule !== 'object' ||
      Array.isArray(rule) ||
      typeof rule.enabled !== 'boolean' ||
      !Number.isFinite(rule.threshold) ||
      rule.threshold <= 0 ||
      !Number.isFinite(rule.windowHours) ||
      rule.windowHours <= 0 ||
      !['warn', 'throttle', 'block', 'warn_then_throttle'].includes(rule.action)
    )
      throw new Error('INVALID_RULES')
  }
  return rules
}

export const alertDetails = raw => {
  let details = raw
  if (typeof raw === 'string') {
    try {
      details = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!details || typeof details !== 'object' || Array.isArray(details))
    return []
  return ['total', 'threshold', 'percent', 'reason', 'dropped', 'project']
    .filter(
      key =>
        typeof details[key] === 'string' ||
        (typeof details[key] === 'number' && Number.isFinite(details[key]))
    )
    .map(key => [key, details[key]])
}
