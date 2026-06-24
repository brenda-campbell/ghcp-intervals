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
})

describe("AnswerGrid keyboard shortcuts", () => {
  const mcOptions = [
    "A serverless compute service",
    "A database service",
    "A CDN service",
    "A DNS service",
  ]
  const tfOptions = ["True", "False"]

  it("selects a multiple-choice option via number keys", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(document, { key: "3" })
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it("selects a multiple-choice option via letter keys (case-insensitive)", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(document, { key: "B" })
    expect(onSelect).toHaveBeenCalledWith(1)
    fireEvent.keyDown(document, { key: "d" })
    expect(onSelect).toHaveBeenCalledWith(3)
  })

  it("ignores keys that do not map to an existing option", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(document, { key: "5" })
    fireEvent.keyDown(document, { key: "z" })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("selects true/false options via 1/T and 2/F", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={tfOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
        questionType="true-false"
      />,
    )
    fireEvent.keyDown(document, { key: "t" })
    expect(onSelect).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(document, { key: "1" })
    expect(onSelect).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(document, { key: "f" })
    expect(onSelect).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(document, { key: "2" })
    expect(onSelect).toHaveBeenLastCalledWith(1)
  })

  it("does not select for true/false via C/D keys", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={tfOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
        questionType="true-false"
      />,
    )
    fireEvent.keyDown(document, { key: "c" })
    fireEvent.keyDown(document, { key: "3" })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("ignores keyboard input when disabled", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={null}
        disabled={true}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(document, { key: "1" })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("ignores keyboard input once a question is answered", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={1}
        disabled={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(document, { key: "2" })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("ignores auto-repeat (held key) events", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(document, { key: "1", repeat: true })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("ignores keyboard events originating from editable fields", () => {
    const onSelect = vi.fn()
    render(
      <div>
        <input data-testid="text-input" />
        <textarea data-testid="text-area" />
        <AnswerGrid
          options={mcOptions}
          selectedIndex={null}
          disabled={false}
          onSelect={onSelect}
        />
      </div>,
    )
    fireEvent.keyDown(screen.getByTestId("text-input"), { key: "1" })
    fireEvent.keyDown(screen.getByTestId("text-area"), { key: "a" })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("ignores shortcuts combined with modifier keys", () => {
    const onSelect = vi.fn()
    render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(document, { key: "1", ctrlKey: true })
    fireEvent.keyDown(document, { key: "a", metaKey: true })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("exposes accessible aria-keyshortcuts on answer buttons", () => {
    render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={() => {}}
      />,
    )
    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toHaveAttribute("aria-keyshortcuts", "1 A")
    expect(buttons[3]).toHaveAttribute("aria-keyshortcuts", "4 D")
  })

  it("exposes true/false aria-keyshortcuts", () => {
    render(
      <AnswerGrid
        options={tfOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={() => {}}
        questionType="true-false"
      />,
    )
    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toHaveAttribute("aria-keyshortcuts", "1 T")
    expect(buttons[1]).toHaveAttribute("aria-keyshortcuts", "2 F")
  })

  it("removes the keyboard listener on unmount", () => {
    const onSelect = vi.fn()
    const { unmount } = render(
      <AnswerGrid
        options={mcOptions}
        selectedIndex={null}
        disabled={false}
        onSelect={onSelect}
      />,
    )
    unmount()
    fireEvent.keyDown(document, { key: "1" })
    expect(onSelect).not.toHaveBeenCalled()
  })
})
