import { useState } from 'react'

/**
 * Which column a table is sorted by, and which way; choosing the same column
 * again turns it round.
 * @template {string} K
 * @param {K} initial
 * @param {'asc'|'desc'} [initialDirection]
 */
export const useSort = (initial, initialDirection = 'asc') => {
  const [state, setState] = useState({
    key: initial,
    direction: initialDirection
  })
  const toggle = next =>
    setState(prev =>
      prev.key === next
        ? { key: next, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key: next, direction: 'asc' }
    )
  return { ...state, toggle }
}

/**
 * Rows in the chosen order (a new array). Null values (no price, not used) go
 * last either way; ties keep the given order.
 * @template T
 * @param {readonly T[]} rows
 * @param {(row: T) => number|string|null} value
 * @param {'asc'|'desc'} direction
 * @returns {T[]}
 */
export const sortRows = (rows, value, direction) => {
  const sign = direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index, value: value(row) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index
      if (a.value === null) return 1
      if (b.value === null) return -1
      const order =
        typeof a.value === 'string' && typeof b.value === 'string'
          ? a.value.localeCompare(b.value, 'en', { numeric: true })
          : Number(a.value) - Number(b.value)
      return order * sign || a.index - b.index
    })
    .map(entry => entry.row)
}
