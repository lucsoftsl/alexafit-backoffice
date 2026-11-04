import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Loads one admin resource: `{ data, error, loading, refreshing, updatedAt,
 * reload(refresh) }`. `reload(true)` asks the server to re-measure; stale
 * data stays on screen while it does. `signal` re-runs it from outside (a
 * global refresh button bumps a counter).
 */
const useAdminResource = (fetcher, { signal = 0, enabled = true } = {}) => {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: enabled,
    refreshing: false,
    updatedAt: null
  })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const seq = useRef(0)

  const reload = useCallback(async (refresh = false) => {
    const id = ++seq.current
    setState(prev => ({
      ...prev,
      error: null,
      loading: prev.data === null,
      refreshing: prev.data !== null
    }))
    try {
      const data = await fetcherRef.current({ refresh })
      if (id !== seq.current) return
      setState({
        data,
        error: null,
        loading: false,
        refreshing: false,
        updatedAt: data?.measuredAt || new Date().toISOString()
      })
    } catch (error) {
      if (id !== seq.current) return
      setState(prev => ({ ...prev, error, loading: false, refreshing: false }))
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    reload(signal > 0)
  }, [enabled, reload, signal])

  return { ...state, reload }
}

export default useAdminResource
