import { useCallback, useEffect, useRef, useState } from 'react'

const EMPTY = {
  items: [],
  nextCursor: null,
  loading: true,
  loadingMore: false,
  error: null,
  loaded: false
}

/**
 * Keyset-paged list. `fetchPage(cursor, signal)` resolves `{ items, nextCursor }`.
 * Reloads from the first page whenever `key` changes (filters); `loadMore`
 * appends the next page. Stale responses are dropped.
 */
const useCursorList = (fetchPage, key) => {
  const [state, setState] = useState(EMPTY)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const controllerRef = useRef(null)

  const run = useCallback(async cursor => {
    controllerRef.current?.abort()
    const controller = new window.AbortController()
    controllerRef.current = controller
    const append = Boolean(cursor)
    setState(prev => ({
      ...prev,
      error: null,
      loading: !append,
      loadingMore: append
    }))
    try {
      const page = await fetchRef.current(cursor, controller.signal)
      if (controller.signal.aborted) return
      setState(prev => ({
        items: append ? [...prev.items, ...page.items] : page.items,
        nextCursor: page.nextCursor || null,
        loading: false,
        loadingMore: false,
        error: null,
        loaded: true
      }))
    } catch (error) {
      if (controller.signal.aborted) return
      setState(prev => ({
        ...prev,
        error,
        loading: false,
        loadingMore: false
      }))
    }
  }, [])

  const reload = useCallback(() => run(null), [run])

  const loadMore = useCallback(() => {
    if (state.nextCursor && !state.loadingMore) run(state.nextCursor)
  }, [run, state.nextCursor, state.loadingMore])

  useEffect(() => {
    run(null)
    return () => controllerRef.current?.abort()
  }, [key, run])

  return { ...state, reload, loadMore }
}

export default useCursorList
