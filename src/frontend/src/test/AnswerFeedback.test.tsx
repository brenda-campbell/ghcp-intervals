import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import { AnswerFeedback } from "@/components/FeedbackOverlay"
import type { AnswerResult } from "@/services/api"

vi.mock("@phosphor-icons/react", () => ({
  CheckCircle: ({ className, ...props }: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "check-icon", className, ...props }),
  XCircle: ({ className, ...props }: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "x-icon", className, ...props }),
}))

vi.mock("@/components/ScoreDelta", () => ({
  ScoreDelta: ({ points }: { points: number }) =>
    React.createElement("span", { "data-testid": "score-delta" }, `+${points}`),
}))

describe("AnswerFeedback", () => {
  it("shows correct state with check icon and message", () => {
    const result: AnswerResult = {
      correct: true,
      correctAnswer: "Answer",
      correctIndex: 0,
      elapsedTimeMs: 2500,
      pointsAwarded: 100,
      timeTaken: 2500,
    }
    render(<AnswerFeedback result={result} />)
    expect(screen.getByText("Correct!")).toBeInTheDocument()
    expect(screen.getByTestId("check-icon")).toBeInTheDocument()
    expect(screen.getByText("2.5s")).toBeInTheDocument()
  })

  it("shows points awarded for correct answer", () => {
    const result: AnswerResult = {
      correct: true,
      correctAnswer: "Answer",
      correctIndex: 0,
      elapsedTimeMs: 1800,
      pointsAwarded: 150,
      timeTaken: 1800,
    }
    render(<AnswerFeedback result={result} />)
    expect(screen.getByTestId("score-delta")).toHaveTextContent("+150")
  })

  it("shows incorrect state with X icon", () => {
    const result: AnswerResult = {
      correct: false,
      correctAnswer: "WebSocket",
      correctIndex: 2,
      elapsedTimeMs: 5000,
      pointsAwarded: 0,
      timeTaken: 5000,
    }
    render(<AnswerFeedback result={result} />)
    expect(screen.getByText("Incorrect")).toBeInTheDocument()
    expect(screen.getByTestId("x-icon")).toBeInTheDocument()
  })

  it("shows correct answer text when incorrect", () => {
    const result: AnswerResult = {
      correct: false,
      correctAnswer: "WebSocket",
      correctIndex: 2,
      elapsedTimeMs: 5000,
      pointsAwarded: 0,
      timeTaken: 5000,
    }
    render(
      <AnswerFeedback
        result={result}
        correctAnswerText="WebSocket"
      />,
    )
    expect(screen.getByText("WebSocket")).toBeInTheDocument()
  })

  it("shows time taken for incorrect answer", () => {
    const result: AnswerResult = {
      correct: false,
      correctAnswer: "Answer",
      correctIndex: 0,
      elapsedTimeMs: 3200,
      pointsAwarded: 0,
      timeTaken: 3200,
    }
    render(<AnswerFeedback result={result} />)
    expect(screen.getByText("3.2s · +0 pts")).toBeInTheDocument()
  })

  it("does not show correct answer text when not provided", () => {
    const result: AnswerResult = {
      correct: false,
      correctAnswer: "Answer",
      correctIndex: 0,
      elapsedTimeMs: 4000,
      pointsAwarded: 0,
      timeTaken: 4000,
    }
    render(<AnswerFeedback result={result} />)
    expect(screen.queryByText("Correct answer:")).not.toBeInTheDocument()
  })
})
