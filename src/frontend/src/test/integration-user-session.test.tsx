import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { UserProvider, useUser } from "@/contexts/UserContext"
import type { User } from "@/services/api"

const mockGetUser = vi.fn()

vi.mock("@/services/api", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = "ApiError"
      this.status = status
    }
  },
}))

function UserDisplay() {
  const { user, isLoading, error } = useUser()
  if (isLoading) return <div data-testid="loading">Loading...</div>
  if (error) return <div data-testid="error">{error}</div>
  if (user) return <div data-testid="user">{user.displayName} - {user.totalScore}</div>
  return <div data-testid="empty">No user</div>
}

const testUser: User = {
  id: "doc-1",
  userId: "user-abc-123",
  displayName: "TestPlayer",
  totalScore: 500,
  gamesPlayed: 5,
  fastestTimeMs: 2000,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-15T00:00:00Z",
}

describe("Integration: User Session", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("loads user by userId on mount", async () => {
    mockGetUser.mockResolvedValue(testUser)

    await act(async () => {
      render(
        <UserProvider userId="user-abc-123">
          <UserDisplay />
        </UserProvider>,
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("TestPlayer - 500")
    })

    expect(mockGetUser).toHaveBeenCalledWith("user-abc-123")
  })

  it("shows error on API failure", async () => {
    mockGetUser.mockRejectedValue(new Error("Network failure"))

    await act(async () => {
      render(
        <UserProvider userId="user-abc-123">
          <UserDisplay />
        </UserProvider>,
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Network failure")
    })
  })

  it("shows loading state initially", async () => {
    mockGetUser.mockImplementation(() => new Promise(() => {}))

    render(
      <UserProvider userId="user-abc-123">
        <UserDisplay />
      </UserProvider>,
    )

    expect(screen.getByTestId("loading")).toBeInTheDocument()
  })
})
