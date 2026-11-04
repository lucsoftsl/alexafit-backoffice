/**
 * Chart parameters shared by the admin pages. Categorical slots are the
 * validated 8-hue light palette (dataviz reference), assigned in fixed order
 * by entity, never cycled: a 9th series folds into "Other".
 */
export const SERIES = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948'
]
export const OTHER_COLOR = '#94a3b8'
export const MAX_SERIES = SERIES.length - 1

export const STATUS = {
  ok: '#047857',
  warn: '#b45309',
  bad: '#be123c'
}

export const axisProps = {
  tick: { fontSize: 11, fill: '#64748b' },
  tickLine: false,
  axisLine: { stroke: '#e2e8f0' }
}

export const gridProps = {
  stroke: '#eef2f7',
  vertical: false
}

export const tooltipProps = {
  cursor: { fill: 'rgb(148 163 184 / 0.12)' },
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 30px -15px rgb(15 23 42 / 0.35)',
    fontSize: 12
  }
}

/**
 * Stable color per entity: the n-th key of a fixed order gets slot n; keys
 * past the colored slots (or unknown keys) share the "Other" gray.
 */
export const colorForKey = (key, orderedKeys, coloredSlots = MAX_SERIES) => {
  const index = orderedKeys.indexOf(key)
  return index >= 0 && index < coloredSlots ? SERIES[index] : OTHER_COLOR
}
