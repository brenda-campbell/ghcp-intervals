import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import { Leaderboard } from "@/components/Leaderboard"
import { mockLeaderboardEntries } from "./fixtures"

// Mock performance.now and requestAnimationFrame for AnimatedScore
vi.spyOn(performance, "now").mockReturnValue(0)
vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
  // Execute immediately to get final value
  cb(10000)
  return 0
})

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) =>
    React.createElement("table", { "data-testid": "table" }, children),
  TableHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("thead", null, children),
  TableBody: ({ children }: { children: React.ReactNode }) =>
    React.createElement("tbody", null, children),
  TableRow: ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) =>
    React.createElement("tr", { className, style }, children),
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("th", { className }, children),
  TableCell: ({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) =>
    React.createElement("td", { className, colSpan }, children),
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: ({ className }: { className?: string }) =>
    React.createElement("hr", { className }),
}))

vi.mock("@/components/RankBadge", () => ({
  RankBadge: ({ rank }: { rank: number }) =>
    React.createElement("span", { "data-testid": `rank-${rank}` }, `#${rank}`),
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

describe("Leaderboard", () => {
  it("renders all entries", () => {
    render(<Leaderboard entries={mockLeaderboardEntries} />)
    mockLeaderboardEntries.forEach((entry) => {
      expect(screen.getByText(entry.displayName)).toBeInTheDocument()
    })
  })

  it("renders rank badges for top entries", () => {
    render(<Leaderboard entries={mockLeaderboardEntries} />)
    expect(screen.getByTestId("rank-1")).toBeInTheDocument()
    expect(screen.getByTestId("rank-2")).toBeInTheDocument()
    expect(screen.getByTestId("rank-3")).toBeInTheDocument()
  })

  it("renders table headers", () => {
    render(<Leaderboard entries={mockLeaderboardEntries} />)
    expect(screen.getByText("Rank")).toBeInTheDocument()
    expect(screen.getByText("Player")).toBeInTheDocument()
    expect(screen.getByText("Score")).toBeInTheDocument()
  })

  it("highlights current user in the list", () => {
    render(
      <Leaderboard entries={mockLeaderboardEntries} currentUserId="u3" />,
    )
    // Charlie (u3) should have "(you)" next to their name
    expect(screen.getByText("(you)")).toBeInTheDocument()
  })

  it("shows separate user rank when outside top entries", () => {
    const userEntry = {
      userId: "u99",
      displayName: "OutsideUser",
      totalScore: 500,
      gamesPlayed: 3,
      fastestTimeMs: 5000,
      rank: 42,
    }

    render(
      <Leaderboard
        entries={mockLeaderboardEntries}
        currentUserId="u99"
        userRank={{ entry: userEntry, rank: 42 }}
      />,
    )

    expect(screen.getByText("OutsideUser")).toBeInTheDocument()
    expect(screen.getByText("your rank")).toBeInTheDocument()
    expect(screen.getByTestId("rank-42")).toBeInTheDocument()
  })

  it("does not show separate rank row when user is in top entries", () => {
    render(
      <Leaderboard
        entries={mockLeaderboardEntries}
        currentUserId="u1"
        userRank={{ entry: mockLeaderboardEntries[0], rank: 1 }}
      />,
    )

    // Should not show the "your rank" separator
    expect(screen.queryByText("your rank")).not.toBeInTheDocument()
  })

  it("displays fastest time formatted correctly", () => {
    const entries = [
      { userId: "u1", displayName: "Alice", totalScore: 5000, gamesPlayed: 20, fastestTimeMs: 1500, rank: 1 },
    ]
    render(<Leaderboard entries={entries} />)
    // 1500ms should display as "1.50s"
    expect(screen.getByText("1.50s")).toBeInTheDocument()
  })

  it("displays dash for zero fastest time", () => {
    const entries = [
      { userId: "u1", displayName: "Alice", totalScore: 0, gamesPlayed: 0, fastestTimeMs: 0, rank: 1 },
    ]
    render(<Leaderboard entries={entries} />)
    expect(screen.getByText("\u2014")).toBeInTheDocument()
  })
})
