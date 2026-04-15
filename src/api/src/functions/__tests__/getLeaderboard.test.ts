import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type { HttpResponseInit } from "@azure/functions";
import { createMockRequest, createMockContext } from "../../__tests__/helpers.js";

vi.mock("@azure/functions", () => ({
  app: { http: vi.fn() },
  output: { generic: vi.fn(() => "mockSignalROutput") },
  input: { generic: vi.fn(() => "mockSignalRInput") },
}));

vi.mock("../../services/cosmosClient.js", () => ({
  questionsContainer: {
    items: { query: vi.fn() },
  },
  usersContainer: {
    item: vi.fn(),
    items: { create: vi.fn(), query: vi.fn() },
  },
  database: {},
}));

vi.mock("../../services/leaderboardService.js", () => ({
  getTopLeaderboard: vi.fn(),
  toLeaderboardEntry: vi.fn(),
}));

import { app } from "@azure/functions";
import { usersContainer } from "../../services/cosmosClient.js";
import { getTopLeaderboard, toLeaderboardEntry } from "../../services/leaderboardService.js";

type Handler = (req: any, ctx: any) => Promise<HttpResponseInit>;
let handler: Handler;

const SAMPLE_LEADERBOARD = [
  { userId: "u1", displayName: "Alice", totalScore: 1000, rank: 1, fastestTimeMs: 1000 },
  { userId: "u2", displayName: "Bob", totalScore: 800, rank: 2, fastestTimeMs: 1200 },
  { userId: "u3", displayName: "Carol", totalScore: 600, rank: 3, fastestTimeMs: 1500 },
];

beforeAll(async () => {
  await import("../getLeaderboard.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("getLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTopLeaderboard).mockResolvedValue(SAMPLE_LEADERBOARD);
  });

  it("returns leaderboard without userRank when no userId", async () => {
    const req = createMockRequest();
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    const body = res.jsonBody as any;
    expect(body.leaderboard).toHaveLength(3);
    expect(body.leaderboard[0].displayName).toBe("Alice");
    expect(body.userRank).toBeUndefined();
  });

  it("returns userRank when userId is in top 10", async () => {
    const req = createMockRequest({ query: { userId: "u2" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    const body = res.jsonBody as any;
    expect(body.userRank).toBeDefined();
    expect(body.userRank.rank).toBe(2);
    expect(body.userRank.entry.displayName).toBe("Bob");
  });

  it("computes rank for userId not in top 10", async () => {
    const mockRead = vi.fn().mockResolvedValue({
      resource: {
        id: "u99",
        userId: "u99",
        displayName: "NewPlayer",
        totalScore: 50,
        gamesPlayed: 1,
        fastestTimeMs: 5000,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    });
    vi.mocked(usersContainer.item).mockReturnValue({ read: mockRead } as any);

    const mockCountFetchAll = vi.fn().mockResolvedValue({ resources: [15] });
    vi.mocked(usersContainer.items.query).mockReturnValue({
      fetchAll: mockCountFetchAll,
    } as any);

    vi.mocked(toLeaderboardEntry).mockReturnValue({
      userId: "u99",
      displayName: "NewPlayer",
      totalScore: 50,
      rank: 16,
      fastestTimeMs: 5000,
    });

    const req = createMockRequest({ query: { userId: "u99" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    const body = res.jsonBody as any;
    expect(body.userRank).toBeDefined();
    expect(body.userRank.rank).toBe(16);
  });

  it("returns leaderboard even if userRank lookup fails", async () => {
    const mockRead = vi.fn().mockRejectedValue(new Error("DB error"));
    vi.mocked(usersContainer.item).mockReturnValue({ read: mockRead } as any);

    const req = createMockRequest({ query: { userId: "u-broken" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    const body = res.jsonBody as any;
    expect(body.leaderboard).toHaveLength(3);
    // userRank is undefined because lookup failed (non-fatal)
  });

  it("returns 500 when getTopLeaderboard fails", async () => {
    vi.mocked(getTopLeaderboard).mockRejectedValue(new Error("DB crash"));

    const req = createMockRequest();
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
    expect((res.jsonBody as any).error).toContain("Failed to fetch leaderboard");
  });

  it("returns empty leaderboard when no users", async () => {
    vi.mocked(getTopLeaderboard).mockResolvedValue([]);

    const req = createMockRequest();
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).leaderboard).toEqual([]);
  });
});
