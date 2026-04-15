import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import React from "react"
import { QuestionPage } from "@/components/QuestionPage"
import type { Question, AnswerResult } from "@/services/api"

// Mock API module
const mockFetchQuestions = vi.fn()
const mockSubmitAnswer = vi.fn()

vi.mock("@/services/api", () => ({
  fetchQuestions: (...args: unknown[]) => mockFetchQuestions(...args),
  submitAnswer: (...args: unknown[]) => mockSubmitAnswer(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = "ApiError"
      this.status = status
    }
  },
}))

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    user: { userId: "test-user", displayName: "TestPlayer", totalScore: 100 },
    isLoading: false,
    error: null,
  }),
}))

vi.mock("@/contexts/SignalRContext", () => ({
  useSignalRContext: () => ({
    connectionState: "connected",
    leaderboardData: null,
    playerActivity: null,
  }),
}))

vi.mock("@phosphor-icons/react", () => ({
  Clock: (props: Record<string, unknown>) => React.createElement("span", { "data-testid": "clock-icon", ...props }),
  ArrowClockwise: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
  UsersThree: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
  Lightning: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
  Trophy: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
  CheckCircle: (props: Record<string, unknown>) => React.createElement("span", { "data-testid": "check-icon", ...props }),
  XCircle: (props: Record<string, unknown>) => React.createElement("span", { "data-testid": "x-icon", ...props }),
  TrendUp: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("span", { className }, children),
}))

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
    size?: string
    style?: React.CSSProperties
  }) => React.createElement("button", { onClick, disabled, className, ...rest }, children),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
}))

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) =>
    React.createElement("div", { "data-testid": "progress", "data-value": value, className }),
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: ({ className }: { className?: string }) =>
    React.createElement("hr", { className }),
}))

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children, variant }: { children: React.ReactNode; variant?: string }) =>
    React.createElement("div", { "data-variant": variant }, children),
  AlertDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  AlertTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}))

vi.mock("@/components/ScoreDelta", () => ({
  ScoreDelta: ({ points }: { points: number }) =>
    React.createElement("span", { "data-testid": "score-delta" }, `+${points}`),
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

const testQuestions: Question[] = [
  {
    id: "q1",
    questionText: "What is Azure Functions?",
    options: ["A serverless compute service", "A database service", "A CDN service", "A DNS service"],
    category: "Azure",
    difficulty: "easy",
  },
  {
    id: "q2",
    questionText: "What does CI/CD stand for?",
    options: [
      "Computer Integration / Computer Delivery",
      "Continuous Integration / Continuous Delivery",
      "Code Integration / Code Deployment",
      "Central Intelligence / Central Delivery",
    ],
    category: "DevOps",
    difficulty: "medium",
  },
  {
    id: "q3",
    questionText: "Which protocol does SignalR use?",
    options: ["FTP", "SMTP", "WebSocket", "IMAP"],
    category: "Azure",
    difficulty: "hard",
  },
]

const correctResult: AnswerResult = {
  correct: true,
  correctIndex: 0,
  pointsAwarded: 100,
  timeTaken: 2500,
}

describe("Integration: Quiz Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock requestAnimationFrame for RoundComplete's animated score
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(10000)
      return 0
    })
  })

  it("loads questions and displays the first one", async () => {
    mockFetchQuestions.mockResolvedValue(testQuestions)

    await act(async () => {
      render(<QuestionPage />)
    })

    await waitFor(() => {
      expect(screen.getByText("What is Azure Functions?")).toBeInTheDocument()
    })
    expect(screen.getByText("Azure")).toBeInTheDocument()
    expect(screen.getByText("easy")).toBeInTheDocument()
    expect(screen.getByText("1 / 3")).toBeInTheDocument()
  })

  it("shows loading skeletons initially", async () => {
    // Make fetchQuestions hang
    mockFetchQuestions.mockImplementation(() => new Promise(() => {}))

    render(<QuestionPage />)
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
  })

  it("selects an answer and shows feedback", async () => {
    mockFetchQuestions.mockResolvedValue(testQuestions)
    mockSubmitAnswer.mockResolvedValue(correctResult)

    await act(async () => {
      render(<QuestionPage />)
    })

    await waitFor(() => {
      expect(screen.getByText("What is Azure Functions?")).toBeInTheDocument()
    })

    // Click the first answer
    await act(async () => {
      fireEvent.click(screen.getByText("A serverless compute service"))
    })

    await waitFor(() => {
      expect(screen.getByText("Correct!")).toBeInTheDocument()
    })
  })

  it("advances to next question after feedback", async () => {
    mockFetchQuestions.mockResolvedValue(testQuestions)
    mockSubmitAnswer.mockResolvedValue(correctResult)

    await act(async () => {
      render(<QuestionPage />)
    })

    await waitFor(() => {
      expect(screen.getByText("What is Azure Functions?")).toBeInTheDocument()
    })

    // Answer first question
    await act(async () => {
      fireEvent.click(screen.getByText("A serverless compute service"))
    })

    await waitFor(() => {
      expect(screen.getByText("Correct!")).toBeInTheDocument()
    })

    // Click manual advance
    fireEvent.click(screen.getByText("Next →"))

    // Wait for transition (200ms delay in component)
    await waitFor(() => {
      expect(screen.getByText("What does CI/CD stand for?")).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it("shows round complete after all questions answered", async () => {
    mockFetchQuestions.mockResolvedValue(testQuestions)
    mockSubmitAnswer.mockResolvedValue(correctResult)

    await act(async () => {
      render(<QuestionPage />)
    })

    // Answer all 3 questions
    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        const buttons = screen.getAllByRole("button")
        const answerButton = buttons.find(b => !b.textContent?.includes("Next") && !b.textContent?.includes("Results"))
        expect(answerButton).toBeTruthy()
      }, { timeout: 2000 })

      const buttons = screen.getAllByRole("button")
      const answerButton = buttons.find(b => !b.textContent?.includes("Next") && !b.textContent?.includes("Results"))
      if (answerButton) {
        await act(async () => {
          fireEvent.click(answerButton)
        })
      }

      await waitFor(() => {
        const advanceBtn = screen.queryByText("Next →") || screen.queryByText("See Results →")
        expect(advanceBtn).toBeTruthy()
      }, { timeout: 3000 })

      const advanceBtn = screen.queryByText("Next →") || screen.queryByText("See Results →")
      if (advanceBtn) {
        fireEvent.click(advanceBtn)
      }

      // Wait for transition
      await new Promise(r => setTimeout(r, 300))
    }

    await waitFor(() => {
      expect(screen.getByText("Round Complete!")).toBeInTheDocument()
    }, { timeout: 3000 })
  }, 20000)

  it("shows error state on API failure", async () => {
    mockFetchQuestions.mockRejectedValue(new Error("Network error"))

    await act(async () => {
      render(<QuestionPage />)
    })

    await waitFor(() => {
      expect(screen.getByText("Failed to load questions")).toBeInTheDocument()
    })

    // Should have a retry button
    expect(screen.getByText("Retry")).toBeInTheDocument()
  })

  it("retries after error", async () => {
    mockFetchQuestions
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(testQuestions)

    await act(async () => {
      render(<QuestionPage />)
    })

    await waitFor(() => {
      expect(screen.getByText("Failed to load questions")).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText("Retry"))
    })

    await waitFor(() => {
      expect(screen.getByText("What is Azure Functions?")).toBeInTheDocument()
    })
  })

  it("prevents double-click on answer (only submits once)", async () => {
    mockFetchQuestions.mockResolvedValue(testQuestions)
    // Slow response to give time for second click
    mockSubmitAnswer.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(correctResult), 200)),
    )

    await act(async () => {
      render(<QuestionPage />)
    })

    await waitFor(() => {
      expect(screen.getByText("What is Azure Functions?")).toBeInTheDocument()
    })

    // Click the first answer
    const answerBtn = screen.getByText("A serverless compute service")
    await act(async () => {
      fireEvent.click(answerBtn)
    })

    // Now selectedIndex is set in state — try clicking a different answer
    const secondBtn = screen.getByText("A database service")
    await act(async () => {
      fireEvent.click(secondBtn)
    })

    // Wait for the first submission to complete
    await waitFor(() => {
      expect(screen.getByText("Correct!")).toBeInTheDocument()
    })

    // Should only have submitted once (the guard: `if (submitting || selectedIndex !== null)`)
    expect(mockSubmitAnswer).toHaveBeenCalledTimes(1)
    expect(mockSubmitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ selectedOption: 0 }),
    )
  })
})
