import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Loads data with `fetcher(signal)` whenever `key` changes (e.g. campaign id
 * plus filters). Stale responses are dropped; old data stays on screen while
 * a reload runs. Returns `{ data, error, loading, reload, setData }`.
 */
const useOrbResource = (fetcher, key, { enabled = true } = {}) => {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: enabled
  })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const controllerRef = useRef(null)

  const reload = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new window.AbortController()
    controllerRef.current = controller
    setState(prev => ({ ...prev, error: null, loading: true }))
    try {
      const data = await fetcherRef.current(controller.signal)
      if (controller.signal.aborted) return
      setState({ data, error: null, loading: false })
    } catch (error) {
      if (controller.signal.aborted) return
      setState(prev => ({ ...prev, error, loading: false }))
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    reload()
    return () => controllerRef.current?.abort()
  }, [enabled, key, reload])

  const setData = useCallback(
    updater =>
      setState(prev => ({
        ...prev,
        data: typeof updater === 'function' ? updater(prev.data) : updater
      })),
    []
  )

  return { ...state, reload, setData }
}

export default useOrbResource
