import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { HowScoringWorksDialog } from "@/components/HowScoringWorksDialog"

// Mock phosphor icons
vi.mock("@phosphor-icons/react", () => ({
  Info: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "info-icon", ...props }),
  X: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "x-icon", ...props }),
}))

// Radix Dialog uses portals — ensure document.body is used
// jsdom supports this natively; no extra setup needed

describe("HowScoringWorksDialog", () => {
  it("renders the trigger button with accessible label", () => {
    render(<HowScoringWorksDialog />)
    const trigger = screen.getByRole("button", { name: /how scoring works/i })
    expect(trigger).toBeInTheDocument()
  })

  it("trigger button has aria-haspopup dialog", () => {
    render(<HowScoringWorksDialog />)
    const trigger = screen.getByRole("button", { name: /how scoring works/i })
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
  })

  it("dialog is not visible before trigger is clicked", () => {
    render(<HowScoringWorksDialog />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens dialog when trigger button is clicked", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("dialog has an accessible title", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText(/how scoring works/i)).toBeInTheDocument()
  })

  it("dialog has an accessible description", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    expect(screen.getByText(/points are awarded based on how quickly/i)).toBeInTheDocument()
  })

  it("shows the maximum points information", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getAllByText(/200 points/i).length).toBeGreaterThan(0)
  })

  it("shows the fastest answer rule", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getAllByText(/fastest correct answer/i).length).toBeGreaterThan(0)
  })

  it("shows zero points for incorrect answers", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    expect(screen.getByText(/zero points/i)).toBeInTheDocument()
  })

  it("shows tie-breaking rule", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    expect(screen.getByText(/cumulative response time/i)).toBeInTheDocument()
  })

  it("shows the worked example with 1.5 seconds and 3 seconds", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    expect(screen.getByText(/1\.5 seconds/i)).toBeInTheDocument()
    expect(screen.getByText(/3 seconds/i)).toBeInTheDocument()
    expect(screen.getByText(/100 points/i)).toBeInTheDocument()
  })

  it("closes dialog when 'Got it' button is clicked", async () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /got it/i }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes dialog when close (X) button is clicked", () => {
    render(<HowScoringWorksDialog />)
    fireEvent.click(screen.getByRole("button", { name: /how scoring works/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /close/i }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes dialog when Escape key is pressed", async () => {
    const user = userEvent.setup()
    render(<HowScoringWorksDialog />)
    await user.click(screen.getByRole("button", { name: /how scoring works/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
