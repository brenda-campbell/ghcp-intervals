import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import React from "react"
import { LeaderboardPage } from "@/components/LeaderboardPage"
import { mockLeaderboardEntries } from "./fixtures"
import type { LeaderboardResponse } from "@/services/api"

const mockGetLeaderboard = vi.fn()

vi.mock("@/services/api", () => ({
  getLeaderboard: (...args: unknown[]) => mockGetLeaderboard(...args),
}))

vi.mock("@/contexts/SignalRContext", () => ({
  useSignalRContext: () => ({
    connectionState: "disconnected",
    leaderboardData: null,
    playerActivity: null,
  }),
}))

vi.mock("@phosphor-icons/react", () => ({
  Trophy: (props: Record<string, unknown>) => React.createElement("span", { "data-testid": "trophy-icon", ...props }),
  ArrowClockwise: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
  Warning: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
  Broadcast: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
  Medal: (props: Record<string, unknown>) => React.createElement("span", { ...props }),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
}))

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children, variant }: { children: React.ReactNode; variant?: string }) =>
    React.createElement("div", { "data-testid": "alert", "data-variant": variant }, children),
  AlertDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  AlertTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    ...rest
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
    variant?: string
    size?: string
  }) => React.createElement("button", { onClick, className, ...rest }, children),
}))

vi.mock("@/components/Leaderboard", () => ({
  Leaderboard: ({ entries, currentUserId }: { entries: unknown[]; currentUserId?: string }) =>
    React.createElement("div", { "data-testid": "leaderboard-table" }, `${entries.length} entries, userId=${currentUserId || "none"}`),
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

describe("Integration: Leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches and displays leaderboard data", async () => {
    const response: LeaderboardResponse = {
      leaderboard: mockLeaderboardEntries,
    }
    mockGetLeaderboard.mockResolvedValue(response)

    await act(async () => {
      render(<LeaderboardPage userId="user-1" />)
    })

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-table")).toBeInTheDocument()
    })

    expect(screen.getByTestId("leaderboard-table")).toHaveTextContent("10 entries")
  })

  it("handles empty leaderboard", async () => {
    mockGetLeaderboard.mockResolvedValue({ leaderboard: [] })

    await act(async () => {
      render(<LeaderboardPage />)
    })

    await waitFor(() => {
      expect(screen.getByText("No scores yet. Be the first to play!")).toBeInTheDocument()
    })
  })

  it("shows error state on fetch failure", async () => {
    mockGetLeaderboard.mockRejectedValue(new Error("Failed to load leaderboard"))

    await act(async () => {
      render(<LeaderboardPage />)
    })

    await waitFor(() => {
      expect(screen.getByTestId("alert")).toBeInTheDocument()
    })

    // Title and description both contain the error text
    expect(screen.getByText("Failed to load leaderboard", { selector: "div" })).toBeInTheDocument()
  })

  it("shows retry button on error", async () => {
    mockGetLeaderboard.mockRejectedValue(new Error("Network error"))

    await act(async () => {
      render(<LeaderboardPage />)
    })

    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument()
    })
  })

  it("shows loading skeletons initially", async () => {
    mockGetLeaderboard.mockImplementation(() => new Promise(() => {}))

    render(<LeaderboardPage />)
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
  })
})
