import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { RoundComplete } from "@/components/RoundComplete"
import type { AnswerResult } from "@/services/api"

vi.mock("@phosphor-icons/react", () => ({
  Lightning: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "lightning-icon", ...props }),
  ArrowClockwise: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "arrow-icon", ...props }),
  Trophy: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "trophy-icon", ...props }),
  CheckCircle: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "check-icon", ...props }),
  XCircle: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "x-icon", ...props }),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { "data-testid": "card", className }, children),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { "data-testid": "card-content", className }, children),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode
    onClick?: () => void
    size?: string
    variant?: string
    className?: string
  }) => React.createElement("button", { onClick, ...rest }, children),
}))

// Mock requestAnimationFrame for animated score
vi.spyOn(performance, "now").mockReturnValue(0)
vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
  cb(10000)
  return 0
})

describe("RoundComplete", () => {
  const correctResult: AnswerResult = {
    correct: true,
    correctIndex: 0,
    pointsAwarded: 100,
    timeTaken: 2500,
  }

  const incorrectResult: AnswerResult = {
    correct: false,
    correctIndex: 2,
    pointsAwarded: 0,
    timeTaken: 5000,
  }

  const mixedResults = [
    { questionText: "Question 1?", result: correctResult },
    { questionText: "Question 2?", result: incorrectResult },
    { questionText: "Question 3?", result: correctResult },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(performance, "now").mockReturnValue(0)
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(10000)
      return 0
    })
  })

  it("displays 'Round Complete!' heading", () => {
    render(
      <RoundComplete
        results={mixedResults}
        onPlayAgain={() => {}}
        onViewLeaderboard={() => {}}
      />,
    )
    expect(screen.getByText("Round Complete!")).toBeInTheDocument()
  })

  it("shows correct count out of total", () => {
    render(
      <RoundComplete
        results={mixedResults}
        onPlayAgain={() => {}}
        onViewLeaderboard={() => {}}
      />,
    )
    expect(screen.getByText("2 / 3 Correct")).toBeInTheDocument()
  })

  it("shows each question text in the summary", () => {
    render(
      <RoundComplete
        results={mixedResults}
        onPlayAgain={() => {}}
        onViewLeaderboard={() => {}}
      />,
    )
    expect(screen.getByText("Question 1?")).toBeInTheDocument()
    expect(screen.getByText("Question 2?")).toBeInTheDocument()
    expect(screen.getByText("Question 3?")).toBeInTheDocument()
  })

  it("shows points per question", () => {
    render(
      <RoundComplete
        results={mixedResults}
        onPlayAgain={() => {}}
        onViewLeaderboard={() => {}}
      />,
    )
    const pointLabels = screen.getAllByText("+100")
    expect(pointLabels.length).toBe(2) // two correct answers
    expect(screen.getByText("+0")).toBeInTheDocument()
  })

  it("calls onPlayAgain when Play Again button clicked", () => {
    const onPlayAgain = vi.fn()
    render(
      <RoundComplete
        results={mixedResults}
        onPlayAgain={onPlayAgain}
        onViewLeaderboard={() => {}}
      />,
    )
    fireEvent.click(screen.getByText("Play Again"))
    expect(onPlayAgain).toHaveBeenCalledOnce()
  })

  it("calls onViewLeaderboard when View Leaderboard clicked", () => {
    const onViewLeaderboard = vi.fn()
    render(
      <RoundComplete
        results={mixedResults}
        onPlayAgain={() => {}}
        onViewLeaderboard={onViewLeaderboard}
      />,
    )
    fireEvent.click(screen.getByText("View Leaderboard"))
    expect(onViewLeaderboard).toHaveBeenCalledOnce()
  })

  it("shows perfect score message when all correct", () => {
    const perfectResults = [
      { questionText: "Q1?", result: correctResult },
      { questionText: "Q2?", result: { ...correctResult, pointsAwarded: 120 } },
    ]
    render(
      <RoundComplete
        results={perfectResults}
        onPlayAgain={() => {}}
        onViewLeaderboard={() => {}}
      />,
    )
    expect(screen.getByText(/Perfect Score/)).toBeInTheDocument()
  })

  it("does not show perfect score message with any incorrect", () => {
    render(
      <RoundComplete
        results={mixedResults}
        onPlayAgain={() => {}}
        onViewLeaderboard={() => {}}
      />,
    )
    expect(screen.queryByText(/Perfect Score/)).not.toBeInTheDocument()
  })
})
