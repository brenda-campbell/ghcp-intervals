import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../cosmosClient.js", () => ({
  usersContainer: {
    items: {
      query: vi.fn(),
    },
  },
  questionsContainer: { items: { query: vi.fn() } },
  database: {},
}));

import {
  getTopLeaderboard,
  toLeaderboardEntry,
} from "../leaderboardService.js";
import { usersContainer } from "../cosmosClient.js";
import type { User } from "../../models/index.js";

describe("toLeaderboardEntry", () => {
  it("maps User to LeaderboardEntry with given rank", () => {
    const user: User = {
      id: "u1",
      userId: "u1",
      displayName: "Alice",
      totalScore: 500,
      gamesPlayed: 10,
      fastestTimeMs: 1500,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    const entry = toLeaderboardEntry(user, 3);

    expect(entry).toEqual({
      userId: "u1",
      displayName: "Alice",
      totalScore: 500,
      rank: 3,
      fastestTimeMs: 1500,
    });
  });

  it("excludes non-leaderboard fields (createdAt, gamesPlayed, etc.)", () => {
    const user: User = {
      id: "u2",
      userId: "u2",
      displayName: "Bob",
      totalScore: 100,
      gamesPlayed: 5,
      fastestTimeMs: 3000,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const entry = toLeaderboardEntry(user, 1);

    expect(entry).not.toHaveProperty("createdAt");
    expect(entry).not.toHaveProperty("updatedAt");
    expect(entry).not.toHaveProperty("gamesPlayed");
    expect(entry).not.toHaveProperty("id");
  });
});

describe("getTopLeaderboard", () => {
  const mockFetchAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersContainer.items.query).mockReturnValue({
      fetchAll: mockFetchAll,
    } as any);
  });

  it("returns top users with sequential ranks", async () => {
    const users: User[] = Array.from({ length: 3 }, (_, i) => ({
      id: `u${i}`,
      userId: `u${i}`,
      displayName: `Player-${i}`,
      totalScore: 300 - i * 100,
      gamesPlayed: 10,
      fastestTimeMs: 1000 + i * 500,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    }));

    mockFetchAll.mockResolvedValue({ resources: users });

    const result = await getTopLeaderboard();

    expect(result).toHaveLength(3);
    expect(result[0].rank).toBe(1);
    expect(result[0].totalScore).toBe(300);
    expect(result[2].rank).toBe(3);
    expect(result[2].totalScore).toBe(100);
  });

  it("uses correct Cosmos DB query with ORDER BY and LIMIT", async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });

    await getTopLeaderboard();

    const query = vi.mocked(usersContainer.items.query).mock.calls[0][0];
    expect((query as any).query).toContain("ORDER BY c.totalScore DESC");
    expect((query as any).query).toContain("LIMIT 10");
  });

  it("returns empty array when no users", async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });
    const result = await getTopLeaderboard();
    expect(result).toEqual([]);
  });

  it("returns up to 10 entries", async () => {
    const users = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      userId: `u${i}`,
      displayName: `P${i}`,
      totalScore: 1000 - i * 10,
      gamesPlayed: 1,
      fastestTimeMs: 1000,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    }));
    mockFetchAll.mockResolvedValue({ resources: users });

    const result = await getTopLeaderboard();

    expect(result).toHaveLength(10);
    expect(result[0].rank).toBe(1);
    expect(result[9].rank).toBe(10);
  });
});
