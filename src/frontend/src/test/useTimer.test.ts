import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTimer } from "@/hooks/useTimer"

describe("useTimer", () => {
  let mockNow: number
  let rafCallbacks: Array<FrameRequestCallback>
  let rafId: number

  beforeEach(() => {
    mockNow = 1000
    rafCallbacks = []
    rafId = 0

    vi.spyOn(performance, "now").mockImplementation(() => mockNow)
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return ++rafId
    })
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {
      rafCallbacks = []
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function flushRaf() {
    const cbs = [...rafCallbacks]
    rafCallbacks = []
    cbs.forEach((cb) => cb(mockNow))
  }

  it("initializes with zero elapsed time", () => {
    const { result } = renderHook(() => useTimer())
    expect(result.current.elapsedMs).toBe(0)
    expect(result.current.elapsedDisplay).toBe("0.0s")
    expect(result.current.isRunning).toBe(false)
    expect(result.current.colorState).toBe("fast")
  })

  it("starts and tracks elapsed time", () => {
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.start()
    })
    expect(result.current.isRunning).toBe(true)

    // Advance time by 2 seconds and trigger rAF
    mockNow = 3000
    act(() => {
      flushRaf()
    })

    expect(result.current.elapsedMs).toBe(2000)
    expect(result.current.elapsedDisplay).toBe("2.0s")
  })

  it("stops and returns final elapsed time", () => {
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.start()
    })

    mockNow = 4500
    let finalMs: number = 0
    act(() => {
      finalMs = result.current.stop()
    })

    expect(finalMs).toBe(3500)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.elapsedMs).toBe(3500)
  })

  it("resets timer to zero", () => {
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.start()
    })
    mockNow = 5000
    act(() => {
      flushRaf()
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.elapsedMs).toBe(0)
    expect(result.current.elapsedDisplay).toBe("0.0s")
    expect(result.current.isRunning).toBe(false)
  })

  it("returns 'fast' color state for < 5 seconds", () => {
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.start()
    })
    mockNow = 4999 + 1000 // 4.999s elapsed
    act(() => {
      flushRaf()
    })

    expect(result.current.colorState).toBe("fast")
  })

  it("returns 'warning' color state for 5-10 seconds", () => {
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.start()
    })
    mockNow = 1000 + 7000 // 7s elapsed
    act(() => {
      flushRaf()
    })

    expect(result.current.colorState).toBe("warning")
  })

  it("returns 'danger' color state for >= 10 seconds", () => {
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.start()
    })
    mockNow = 1000 + 12000 // 12s elapsed
    act(() => {
      flushRaf()
    })

    expect(result.current.colorState).toBe("danger")
  })

  it("formats display correctly", () => {
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.start()
    })
    mockNow = 1000 + 3200
    act(() => {
      flushRaf()
    })

    expect(result.current.elapsedDisplay).toBe("3.2s")
  })

  it("cleans up animation frame on unmount", () => {
    const { result, unmount } = renderHook(() => useTimer())

    act(() => {
      result.current.start()
    })

    unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
