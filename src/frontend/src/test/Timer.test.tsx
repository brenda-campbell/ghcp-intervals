import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import { Timer } from "@/components/Timer"

vi.mock("@phosphor-icons/react", () => ({
  Clock: ({ className, ...props }: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "clock-icon", className, ...props }),
}))

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) =>
    React.createElement("div", { "data-testid": "progress", "data-value": value, className }),
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

describe("Timer", () => {
  it("displays the elapsed time string", () => {
    render(
      <Timer
        elapsedMs={3200}
        elapsedDisplay="3.2s"
        isRunning={true}
        colorState="fast"
      />,
    )
    expect(screen.getByText("3.2s")).toBeInTheDocument()
  })

  it("displays zero time initially", () => {
    render(
      <Timer
        elapsedMs={0}
        elapsedDisplay="0.0s"
        isRunning={false}
        colorState="fast"
      />,
    )
    expect(screen.getByText("0.0s")).toBeInTheDocument()
  })

  it("renders clock icon", () => {
    render(
      <Timer
        elapsedMs={0}
        elapsedDisplay="0.0s"
        isRunning={false}
        colorState="fast"
      />,
    )
    expect(screen.getByTestId("clock-icon")).toBeInTheDocument()
  })

  it("renders progress bar", () => {
    render(
      <Timer
        elapsedMs={7500}
        elapsedDisplay="7.5s"
        isRunning={true}
        colorState="warning"
      />,
    )
    const progress = screen.getByTestId("progress")
    expect(progress).toBeInTheDocument()
    // 7.5s / 15s max = 50%
    expect(progress.getAttribute("data-value")).toBe("50")
  })

  it("caps progress at 100%", () => {
    render(
      <Timer
        elapsedMs={20000}
        elapsedDisplay="20.0s"
        isRunning={true}
        colorState="danger"
      />,
    )
    const progress = screen.getByTestId("progress")
    expect(Number(progress.getAttribute("data-value"))).toBeLessThanOrEqual(100)
  })

  it("applies fast color classes", () => {
    render(
      <Timer
        elapsedMs={2000}
        elapsedDisplay="2.0s"
        isRunning={true}
        colorState="fast"
      />,
    )
    // The time display should have the lime/fast color class
    const timeEl = screen.getByText("2.0s")
    expect(timeEl.className).toContain("text-[#C5F542]")
  })

  it("applies warning color classes", () => {
    render(
      <Timer
        elapsedMs={7000}
        elapsedDisplay="7.0s"
        isRunning={true}
        colorState="warning"
      />,
    )
    const timeEl = screen.getByText("7.0s")
    expect(timeEl.className).toContain("text-amber-400")
  })

  it("applies danger color classes", () => {
    render(
      <Timer
        elapsedMs={12000}
        elapsedDisplay="12.0s"
        isRunning={true}
        colorState="danger"
      />,
    )
    const timeEl = screen.getByText("12.0s")
    expect(timeEl.className).toContain("text-red-500")
  })

  it("applies running animation classes when running", () => {
    render(
      <Timer
        elapsedMs={2000}
        elapsedDisplay="2.0s"
        isRunning={true}
        colorState="fast"
      />,
    )
    const timeEl = screen.getByText("2.0s")
    expect(timeEl.className).toContain("animate-[timer-pulse")
  })

  it("applies freeze animation when stopped with time > 0", () => {
    render(
      <Timer
        elapsedMs={5000}
        elapsedDisplay="5.0s"
        isRunning={false}
        colorState="warning"
      />,
    )
    const timeEl = screen.getByText("5.0s")
    expect(timeEl.className).toContain("animate-[timer-freeze")
  })
})
