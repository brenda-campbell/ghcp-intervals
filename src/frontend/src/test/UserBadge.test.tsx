import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import { UserBadge } from "@/components/UserBadge"
import type { User } from "@/services/api"

vi.mock("@phosphor-icons/react", () => ({
  User: ({ className, ...props }: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "user-icon", className, ...props }),
  Trophy: ({ className, ...props }: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "trophy-icon", className, ...props }),
  TrendUp: ({ className, ...props }: Record<string, unknown>) =>
    React.createElement("span", { "data-testid": "trend-icon", className, ...props }),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) =>
    React.createElement("span", { "data-testid": "badge", className, "data-variant": variant }, children),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
}))

const mockUseUser = vi.fn()
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => mockUseUser(),
}))

describe("UserBadge", () => {
  const mockUser: User = {
    id: "doc-1",
    userId: "user-123",
    displayName: "TestPlayer",
    totalScore: 1500,
    gamesPlayed: 10,
    fastestTimeMs: 2340,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-15T00:00:00Z",
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows skeleton while loading", () => {
    mockUseUser.mockReturnValue({ user: null, isLoading: true, error: null })
    render(<UserBadge />)
    expect(screen.getByTestId("skeleton")).toBeInTheDocument()
  })

  it("shows display name and score when loaded", () => {
    mockUseUser.mockReturnValue({ user: mockUser, isLoading: false, error: null })
    render(<UserBadge />)
    expect(screen.getByText("TestPlayer")).toBeInTheDocument()
    expect(screen.getByText("1500")).toBeInTheDocument()
  })

  it("shows offline badge on error", () => {
    mockUseUser.mockReturnValue({ user: null, isLoading: false, error: "Failed" })
    render(<UserBadge />)
    expect(screen.getByText("Offline")).toBeInTheDocument()
  })

  it("shows offline badge when user is null and not loading", () => {
    mockUseUser.mockReturnValue({ user: null, isLoading: false, error: null })
    render(<UserBadge />)
    expect(screen.getByText("Offline")).toBeInTheDocument()
  })
})
