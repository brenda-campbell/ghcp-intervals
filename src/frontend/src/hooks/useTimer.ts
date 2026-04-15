import { useCallback, useEffect, useRef, useState } from "react"

export type TimerColorState = "fast" | "warning" | "danger"

interface TimerReturn {
  /** Elapsed time in milliseconds (high precision) */
  elapsedMs: number
  /** Formatted display string, e.g. "3.2s" */
  elapsedDisplay: string
  /** Start timing from 0 */
  start: () => void
  /** Stop timing and return final elapsed ms */
  stop: () => number
  /** Reset timer to 0 */
  reset: () => void
  /** Whether the timer is currently running */
  isRunning: boolean
  /** Color zone based on elapsed seconds */
  colorState: TimerColorState
}

function getColorState(ms: number): TimerColorState {
  const s = ms / 1000
  if (s < 5) return "fast"
  if (s < 10) return "warning"
  return "danger"
}

function formatDisplay(ms: number): string {
  const seconds = ms / 1000
  return `${seconds.toFixed(1)}s`
}

export function useTimer(): TimerReturn {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const startTimeRef = useRef<number>(0)
  const rafIdRef = useRef<number>(0)
  const finalMsRef = useRef<number>(0)

  const tick = useCallback(() => {
    const now = performance.now()
    const elapsed = now - startTimeRef.current
    setElapsedMs(elapsed)
    finalMsRef.current = elapsed
    rafIdRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(() => {
    startTimeRef.current = performance.now()
    finalMsRef.current = 0
    setElapsedMs(0)
    setIsRunning(true)
    rafIdRef.current = requestAnimationFrame(tick)
  }, [tick])

  const stop = useCallback((): number => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
    }
    // Capture final time with precision
    const finalMs = performance.now() - startTimeRef.current
    finalMsRef.current = finalMs
    setElapsedMs(finalMs)
    setIsRunning(false)
    return finalMs
  }, [])

  const reset = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
    }
    startTimeRef.current = 0
    finalMsRef.current = 0
    setElapsedMs(0)
    setIsRunning(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  return {
    elapsedMs,
    elapsedDisplay: formatDisplay(elapsedMs),
    start,
    stop,
    reset,
    isRunning,
    colorState: getColorState(elapsedMs),
  }
}
