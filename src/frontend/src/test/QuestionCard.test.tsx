import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import { QuestionCard } from "@/components/QuestionCard"

// Mock the UI components to simplify testing
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { "data-testid": "card", className }, children),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { "data-testid": "card-header", className }, children),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { "data-testid": "card-content", className }, children),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) =>
    React.createElement("span", { "data-testid": "badge", className, "data-variant": variant }, children),
}))

describe("QuestionCard", () => {
  it("renders question text", () => {
    render(
      <QuestionCard
        questionText="What is Azure?"
        category="Azure"
        difficulty="easy"
        questionNumber={1}
        totalQuestions={3}
      />,
    )
    expect(screen.getByText("What is Azure?")).toBeInTheDocument()
  })

  it("renders category badge", () => {
    render(
      <QuestionCard
        questionText="Test question"
        category="DevOps"
        difficulty="medium"
        questionNumber={1}
        totalQuestions={3}
      />,
    )
    expect(screen.getByText("DevOps")).toBeInTheDocument()
  })

  it("renders difficulty badge", () => {
    render(
      <QuestionCard
        questionText="Test question"
        category="Azure"
        difficulty="hard"
        questionNumber={2}
        totalQuestions={5}
      />,
    )
    expect(screen.getByText("hard")).toBeInTheDocument()
  })

  it("renders question number and total", () => {
    render(
      <QuestionCard
        questionText="Test question"
        category="Azure"
        difficulty="easy"
        questionNumber={2}
        totalQuestions={5}
      />,
    )
    expect(screen.getByText("2 / 5")).toBeInTheDocument()
  })

  it("renders children content", () => {
    render(
      <QuestionCard
        questionText="Test question"
        category="Azure"
        difficulty="easy"
        questionNumber={1}
        totalQuestions={1}
      >
        <div data-testid="child-content">Answer options here</div>
      </QuestionCard>,
    )
    expect(screen.getByTestId("child-content")).toBeInTheDocument()
  })

  it("applies correct difficulty color class for easy", () => {
    render(
      <QuestionCard
        questionText="Test question"
        category="Azure"
        difficulty="easy"
        questionNumber={1}
        totalQuestions={1}
      />,
    )
    const badges = screen.getAllByTestId("badge")
    const difficultyBadge = badges.find((b) => b.textContent === "easy")
    expect(difficultyBadge).toBeDefined()
    expect(difficultyBadge?.className).toContain("bg-green")
  })

  it("applies correct difficulty color class for medium", () => {
    render(
      <QuestionCard
        questionText="Test"
        category="Azure"
        difficulty="medium"
        questionNumber={1}
        totalQuestions={1}
      />,
    )
    const badges = screen.getAllByTestId("badge")
    const difficultyBadge = badges.find((b) => b.textContent === "medium")
    expect(difficultyBadge?.className).toContain("bg-amber")
  })

  it("applies correct difficulty color class for hard", () => {
    render(
      <QuestionCard
        questionText="Test"
        category="Azure"
        difficulty="hard"
        questionNumber={1}
        totalQuestions={1}
      />,
    )
    const badges = screen.getAllByTestId("badge")
    const difficultyBadge = badges.find((b) => b.textContent === "hard")
    expect(difficultyBadge?.className).toContain("bg-destructive")
  })
})
