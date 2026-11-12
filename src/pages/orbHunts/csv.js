/**
 * Client-side CSV export. Fields are quoted when needed (RFC 4180) and cells
 * that a spreadsheet would run as a formula (=, +, -, @, tab, CR) get a
 * leading apostrophe, so exported user names can't inject formulas.
 */
const FORMULA_START = /^[=+\-@\t\r]/

export const escapeCsvCell = value => {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * @param {Array<{ key: string, label: string, value?: (row: object) => unknown }>} columns
 * @param {object[]} rows
 * @returns {string}
 */
export const toCsv = (columns, rows) => {
  const header = columns.map(c => escapeCsvCell(c.label)).join(',')
  const lines = rows.map(row =>
    columns
      .map(c => escapeCsvCell(c.value ? c.value(row) : row[c.key]))
      .join(',')
  )
  return [header, ...lines].join('\r\n')
}

/** Saves text as a UTF-8 CSV file (with BOM so Excel reads accents). */
export const downloadCsv = (filename, text) => {
  const blob = new window.Blob(['﻿', text], {
    type: 'text/csv;charset=utf-8'
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export const csvFilename = (prefix, campaignId) =>
  `${prefix}-${String(campaignId || '').slice(0, 8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`
