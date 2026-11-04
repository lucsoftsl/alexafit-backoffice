import { useEffect, useRef, useState } from 'react'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_QUERY).matches

/** Recharts entry animation: short, and off for reduced motion. */
export const chartAnimation = () =>
  prefersReducedMotion()
    ? { isAnimationActive: false }
    : {
        isAnimationActive: true,
        animationDuration: 240,
        animationEasing: 'ease-out'
      }

const COUNT_UP_MS = 240
const easeOut = t => 1 - (1 - t) ** 3

/**
 * Animates a number from its previous value to `target` (window.requestAnimationFrame,
 * ~240ms). Non-numbers pass through. Reduced motion → jumps straight there.
 */
export const useCountUp = target => {
  const numeric = typeof target === 'number' && Number.isFinite(target)
  const [value, setValue] = useState(numeric ? target : 0)
  const fromRef = useRef(numeric ? target : 0)
  const firstRef = useRef(true)

  useEffect(() => {
    if (!numeric) return undefined
    // First paint counts up from 0 so tiles feel alive on load.
    const from = firstRef.current ? 0 : fromRef.current
    firstRef.current = false
    if (prefersReducedMotion() || from === target) {
      fromRef.current = target
      setValue(target)
      return undefined
    }
    let frame = 0
    const start = window.performance.now()
    const tick = now => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      const next = from + (target - from) * easeOut(t)
      setValue(next)
      fromRef.current = next
      if (t < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [numeric, target])

  return numeric ? value : target
}

/** Re-renders every `intervalMs` so "updated 2 min ago" stays true. */
export const useNow = (intervalMs = 30000) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
