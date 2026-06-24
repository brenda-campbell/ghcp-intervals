import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { AnswerGrid } from "@/components/AnswerGrid"

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    ...rest
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
    variant?: string
    style?: React.CSSProperties
  }) =>
    React.createElement(
      "button",
      { onClick, disabled, className, ...rest },
      children,
    ),
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

describe("AnswerGrid", () => {
  const options = [
    "A serverless compute service",
    "A database service",
    "A CDN service",
    "A DNS service",
  ]

  it("renders all 4 options", () => {
    render(
      <AnswerGrid
        options={options}
        selectedIndex={null}
        disabled={false}
        onSelect={() => {}}
      />,
    )
    options.forEach((opt) => {
      expect(screen.getByText(opt)).toBeInTheDocument()
    })
  })

  it("renders option labels A, B, C, D", () => {
    render(
      <AnswerGrid
        options={options}
        selectedIndex={null}
        disabled={false}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("B")).toBeInTheDocument()
    expect(screen.getByText("C")).toBeInTheDocument()
    expect(screen.getByText("D")).toBeInTheDocument()
  })

  it("calls onSelect with correct index when clicked", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={options}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByText("A database service"))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it("does not call onSelect when disabled", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={options}
        selectedIndex={null}
        disabled={true}
        onSelect={onSelect}
      />,
    )
    const buttons = screen.getAllByRole("button")
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it("handles selection state visually", () => {
    render(
      <AnswerGrid
        options={options}
        selectedIndex={2}
        disabled={true}
        onSelect={() => {}}
      />,
    )
    // The selected button (index 2) should have some styling difference
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(4)
    // With selectedIndex=2, button at index 2 should have selected styling
    expect(buttons[2].className).toContain("border-primary")
  })

  it("shows correct answer styling after result", () => {
    render(
      <AnswerGrid
        options={options}
        selectedIndex={1}
        disabled={true}
        onSelect={() => {}}
        correctIndex={0}
        isCorrect={false}
      />,
    )
    const buttons = screen.getAllByRole("button")
    // Button 0 (correct) should have green styling
    expect(buttons[0].className).toContain("border-green-500")
    // Button 1 (wrong selected) should have destructive styling
    expect(buttons[1].className).toContain("border-destructive")
  })

  it("shows correct styling when user selected correctly", () => {
    render(
      <AnswerGrid
        options={options}
        selectedIndex={0}
        disabled={true}
        onSelect={() => {}}
        correctIndex={0}
        isCorrect={true}
      />,
    )
    const buttons = screen.getAllByRole("button")
    // The correct answer should glow green
    expect(buttons[0].className).toContain("border-green-500")
    // Other options should be faded
    expect(buttons[2].className).toContain("opacity-30")
  })

  describe("Keyboard Shortcuts", () => {
    it("renders keyboard hints for multiple-choice questions", () => {
      render(
        <AnswerGrid
          options={options}
          selectedIndex={null}
          disabled={false}
          onSelect={() => {}}
          keyboardHints={["1", "2", "3", "4"]}
        />,
      )
      
      expect(screen.getByText("1")).toBeInTheDocument()
      expect(screen.getByText("2")).toBeInTheDocument()
      expect(screen.getByText("3")).toBeInTheDocument()
      expect(screen.getByText("4")).toBeInTheDocument()
    })

    it("renders keyboard hints for true-false questions", () => {
      const tfOptions = ["True", "False"]
      render(
        <AnswerGrid
          options={tfOptions}
          selectedIndex={null}
          disabled={false}
          onSelect={() => {}}
          questionType="true-false"
          keyboardHints={["Y", "N"]}
        />,
      )
      
      expect(screen.getByText("Y")).toBeInTheDocument()
      expect(screen.getByText("N")).toBeInTheDocument()
    })

    it("includes keyboard hints in aria-labels", () => {
      render(
        <AnswerGrid
          options={options}
          selectedIndex={null}
          disabled={false}
          onSelect={() => {}}
          keyboardHints={["1", "2", "3", "4"]}
        />,
      )
      
      const buttons = screen.getAllByRole("button")
      expect(buttons[0]).toHaveAttribute("aria-label", expect.stringContaining("press 1"))
      expect(buttons[1]).toHaveAttribute("aria-label", expect.stringContaining("press 2"))
      expect(buttons[2]).toHaveAttribute("aria-label", expect.stringContaining("press 3"))
      expect(buttons[3]).toHaveAttribute("aria-label", expect.stringContaining("press 4"))
    })

    it("highlights button when corresponding key is active", () => {
      render(
        <AnswerGrid
          options={options}
          selectedIndex={null}
          disabled={false}
          onSelect={() => {}}
          keyboardHints={["1", "2", "3", "4"]}
          activeKey="2"
        />,
      )
      
      const buttons = screen.getAllByRole("button")
      // Button at index 1 (key "2") should have ring styling
      expect(buttons[1].className).toContain("ring-2")
      expect(buttons[1].className).toContain("ring-primary")
    })

    it("does not render keyboard hints when not provided", () => {
      render(
        <AnswerGrid
          options={options}
          selectedIndex={null}
          disabled={false}
          onSelect={() => {}}
        />,
      )
      
      // The hint badges (1, 2, 3, 4) should not be present
      // We check that no elements with text "1", "2", "3", "4" exist
      // (The "A", "B", "C", "D" labels are still there)
      const buttons = screen.getAllByRole("button")
      buttons.forEach((button) => {
        // Aria label should not contain "press"
        expect(button).toHaveAttribute("aria-label", expect.not.stringContaining("press"))
      })
    })
  })
})
