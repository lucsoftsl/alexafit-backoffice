import { useEffect, useState } from 'react'

import { getTableSummary } from '../../services/tableApi'

import { REPORTS_CHANGED_EVENT } from './model'

const POLL_MS = 3 * 60 * 1000

/**
 * Open The Table reports, polled every 3 minutes while `enabled` (ADMIN),
 * on tab focus and right after a moderation action. `null` until loaded or
 * when the API is unreachable (no badge rather than a wrong one).
 */
const useOpenReportsCount = enabled => {
  const [count, setCount] = useState(null)

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      return undefined
    }
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const summary = await getTableSummary()
        if (active) setCount(Number(summary?.openReports) || 0)
      } catch {
        if (active) setCount(null)
      } finally {
        pending = false
      }
    }
    refresh()
    const timer = window.setInterval(refresh, POLL_MS)
    window.addEventListener(REPORTS_CHANGED_EVENT, refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener(REPORTS_CHANGED_EVENT, refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled])

  return count
}

export default useOpenReportsCount
