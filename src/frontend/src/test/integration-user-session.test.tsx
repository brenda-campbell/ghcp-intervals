import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { UserProvider, useUser } from "@/contexts/UserContext"
import type { User } from "@/services/api"

const mockGetUser = vi.fn()
const mockCreateUser = vi.fn()

vi.mock("@/services/api", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  createUser: (...args: unknown[]) => mockCreateUser(...args),
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
  let mockStorage: Record<string, string>

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = {}
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => mockStorage[key] ?? null)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
      mockStorage[key] = value
    })
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key: string) => {
      delete mockStorage[key]
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates new user on first visit (no stored ID)", async () => {
    mockCreateUser.mockResolvedValue(testUser)

    await act(async () => {
      render(
        <UserProvider>
          <UserDisplay />
        </UserProvider>,
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("TestPlayer - 500")
    })

    expect(mockCreateUser).toHaveBeenCalledOnce()
    expect(localStorage.setItem).toHaveBeenCalledWith("ff_userId", "user-abc-123")
  })

  it("loads existing user from localStorage on refresh", async () => {
    mockStorage["ff_userId"] = "user-abc-123"
    mockGetUser.mockResolvedValue(testUser)

    await act(async () => {
      render(
        <UserProvider>
          <UserDisplay />
        </UserProvider>,
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("TestPlayer - 500")
    })

    expect(mockGetUser).toHaveBeenCalledWith("user-abc-123")
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it("creates new user when stored ID returns 404", async () => {
    const { ApiError } = await import("@/services/api")
    mockStorage["ff_userId"] = "stale-id"
    mockGetUser.mockRejectedValue(new ApiError(404, "Not found"))
    mockCreateUser.mockResolvedValue(testUser)

    await act(async () => {
      render(
        <UserProvider>
          <UserDisplay />
        </UserProvider>,
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("TestPlayer - 500")
    })

    expect(mockCreateUser).toHaveBeenCalledOnce()
  })

  it("shows error on API failure", async () => {
    mockCreateUser.mockRejectedValue(new Error("Network failure"))

    await act(async () => {
      render(
        <UserProvider>
          <UserDisplay />
        </UserProvider>,
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Network failure")
    })
  })

  it("handles localStorage being unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage is not available")
    })
    mockCreateUser.mockResolvedValue(testUser)

    await act(async () => {
      render(
        <UserProvider>
          <UserDisplay />
        </UserProvider>,
      )
    })

    // Should show error since localStorage throws
    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeInTheDocument()
    })
  })
})
