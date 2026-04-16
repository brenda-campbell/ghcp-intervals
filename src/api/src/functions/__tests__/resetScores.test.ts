import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type { HttpResponseInit } from "@azure/functions";
import { createMockRequest, createMockContext } from "../../__tests__/helpers.js";

vi.mock("@azure/functions", () => ({
  app: { http: vi.fn() },
  output: { generic: vi.fn(() => "mockSignalROutput") },
  input: { generic: vi.fn(() => "mockSignalRInput") },
}));

vi.mock("../../services/cosmosClient.js", () => ({
  usersContainer: {
    item: vi.fn(),
    items: { query: vi.fn(), upsert: vi.fn() },
  },
  categoryScoresContainer: {
    item: vi.fn(),
    items: { query: vi.fn() },
  },
  database: {},
}));

vi.mock("../../services/adminAuth.js", () => ({
  requireAdmin: vi.fn(),
}));

import { app } from "@azure/functions";
import {
  usersContainer,
  categoryScoresContainer,
} from "../../services/cosmosClient.js";
import { requireAdmin } from "../../services/adminAuth.js";

type Handler = (req: any, ctx: any) => Promise<HttpResponseInit>;
let handler: Handler;

const ADMIN_USER = {
  id: "admin-1",
  userId: "admin-1",
  email: "admin@example.com",
  displayName: "Admin",
  isActive: true,
  isAdmin: true,
  totalScore: 0,
  gamesPlayed: 0,
  fastestTimeMs: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const USER_A = {
  id: "user-a",
  userId: "user-a",
  email: "a@example.com",
  displayName: "Alice",
  isActive: true,
  isAdmin: false,
  totalScore: 100,
  gamesPlayed: 5,
  fastestTimeMs: 3000,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const USER_B = {
  id: "user-b",
  userId: "user-b",
  email: "b@example.com",
  displayName: "Bob",
  isActive: true,
  isAdmin: false,
  totalScore: 200,
  gamesPlayed: 10,
  fastestTimeMs: 2500,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const ALL_CATEGORY_SCORES = [
  { id: "user-a_cat-azure", userId: "user-a", categoryId: "cat-azure" },
  { id: "user-b_cat-azure", userId: "user-b", categoryId: "cat-azure" },
  { id: "user-a_cat-github", userId: "user-a", categoryId: "cat-github" },
];

beforeAll(async () => {
  await import("../resetScores.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("resetScores", () => {
  const mockUsersFetchAll = vi.fn();
  const mockCatScoresFetchAll = vi.fn();
  const mockCatScoreDelete = vi.fn();
  const mockUsersUpsert = vi.mocked(usersContainer.items.upsert);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER as any);

    // usersContainer.items.query().fetchAll()
    vi.mocked(usersContainer.items.query).mockReturnValue({
      fetchAll: mockUsersFetchAll,
    } as any);
    mockUsersFetchAll.mockResolvedValue({
      resources: [{ ...USER_A }, { ...USER_B }],
    });

    // usersContainer.item(id, id).read()
    vi.mocked(usersContainer.item).mockImplementation((id: string) => ({
      read: () => {
        if (id === "user-a")
          return Promise.resolve({ resource: { ...USER_A } });
        if (id === "user-b")
          return Promise.resolve({ resource: { ...USER_B } });
        return Promise.resolve({ resource: undefined });
      },
    }) as any);

    mockUsersUpsert.mockImplementation(
      async (doc: any) => ({ resource: doc }) as any
    );

    // categoryScoresContainer.items.query().fetchAll()
    vi.mocked(categoryScoresContainer.items.query).mockReturnValue({
      fetchAll: mockCatScoresFetchAll,
    } as any);
    mockCatScoresFetchAll.mockResolvedValue({
      resources: [...ALL_CATEGORY_SCORES],
    });

    // categoryScoresContainer.item(id, pk).delete()
    mockCatScoreDelete.mockResolvedValue({});
    vi.mocked(categoryScoresContainer.item).mockReturnValue({
      delete: mockCatScoreDelete,
    } as any);
  });

  // === Auth gating ===

  it("returns 401 when no x-user-id header", async () => {
    vi.mocked(requireAdmin).mockRejectedValue({
      status: 401,
      message: "Missing x-user-id header",
    });
    const req = createMockRequest({ body: { scope: "all" }, headers: {} });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(401);
    expect((res.jsonBody as any).error).toContain("x-user-id");
  });

  it("returns 403 when user is not admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue({
      status: 403,
      message: "Admin access required",
    });
    const req = createMockRequest({
      body: { scope: "all" },
      headers: { "x-user-id": "regular-user" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(403);
    expect((res.jsonBody as any).error).toContain("Admin");
  });

  it("returns 403 when user not found", async () => {
    vi.mocked(requireAdmin).mockRejectedValue({
      status: 403,
      message: "User not found",
    });
    const req = createMockRequest({
      body: { scope: "all" },
      headers: { "x-user-id": "ghost" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(403);
    expect((res.jsonBody as any).error).toContain("User not found");
  });

  // === Validation ===

  it("returns 400 when scope is missing", async () => {
    const req = createMockRequest({
      body: {},
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("scope");
  });

  it('returns 400 when scope is "selected" but no userIds provided', async () => {
    const req = createMockRequest({
      body: { scope: "selected" },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("userIds");
  });

  it('returns 400 when scope is "selected" and userIds is empty array', async () => {
    const req = createMockRequest({
      body: { scope: "selected", userIds: [] },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("userIds");
  });

  // === Reset All ===

  it("resets all users' scores (totalScore=0, gamesPlayed=0, fastestTimeMs=0)", async () => {
    const req = createMockRequest({
      body: { scope: "all" },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).reset).toBe(true);
    expect((res.jsonBody as any).usersAffected).toBe(2);

    expect(mockUsersUpsert).toHaveBeenCalledTimes(2);
    for (const call of mockUsersUpsert.mock.calls) {
      const doc = call[0] as any;
      expect(doc.totalScore).toBe(0);
      expect(doc.gamesPlayed).toBe(0);
      expect(doc.fastestTimeMs).toBe(0);
    }
  });

  it("deletes all categoryScores documents on scope all", async () => {
    const req = createMockRequest({
      body: { scope: "all" },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    await handler(req, ctx);

    expect(mockCatScoreDelete).toHaveBeenCalledTimes(3);
  });

  // === Reset Selected ===

  it("resets only specified users' scores", async () => {
    const req = createMockRequest({
      body: { scope: "selected", userIds: ["user-a"] },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).usersAffected).toBe(1);
    expect(mockUsersUpsert).toHaveBeenCalledTimes(1);
    const doc = mockUsersUpsert.mock.calls[0][0] as any;
    expect(doc.userId).toBe("user-a");
    expect(doc.totalScore).toBe(0);
    expect(doc.gamesPlayed).toBe(0);
    expect(doc.fastestTimeMs).toBe(0);
  });

  it("does not affect unspecified users", async () => {
    const req = createMockRequest({
      body: { scope: "selected", userIds: ["user-a"] },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    await handler(req, ctx);

    const upsertedIds = mockUsersUpsert.mock.calls.map(
      (c) => (c[0] as any).userId
    );
    expect(upsertedIds).toContain("user-a");
    expect(upsertedIds).not.toContain("user-b");
  });

  // === Category-scoped reset ===

  it("only deletes categoryScores for the specified categoryId", async () => {
    mockCatScoresFetchAll.mockResolvedValue({
      resources: [
        { id: "user-a_cat-azure", categoryId: "cat-azure" },
        { id: "user-b_cat-azure", categoryId: "cat-azure" },
      ],
    });

    const req = createMockRequest({
      body: { scope: "all", categoryId: "cat-azure" },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    await handler(req, ctx);

    // Only the 2 cat-azure docs deleted — not cat-github
    expect(mockCatScoreDelete).toHaveBeenCalledTimes(2);
  });

  it("does not reset global user scores when categoryId is provided", async () => {
    const req = createMockRequest({
      body: { scope: "all", categoryId: "cat-azure" },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    // Global user scores should NOT be touched
    expect(mockUsersUpsert).not.toHaveBeenCalled();
    // But usersAffected still reflects count of queried users
    expect((res.jsonBody as any).usersAffected).toBe(2);
  });

  // === SignalR broadcast ===

  it("broadcasts scoresReset event with affected count", async () => {
    const req = createMockRequest({
      body: { scope: "all" },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    await handler(req, ctx);

    expect(ctx.extraOutputs.set).toHaveBeenCalled();
    const messages = (ctx.extraOutputs.set as any).mock.calls[0][1];
    const resetMsg = Array.isArray(messages)
      ? messages.find((m: any) => m.target === "scoresReset")
      : messages.target === "scoresReset"
        ? messages
        : undefined;
    expect(resetMsg).toBeDefined();
    expect(resetMsg.arguments[0].usersAffected).toBe(2);
    expect(resetMsg.arguments[0].scope).toBe("all");
    expect(resetMsg.arguments[0].resetBy).toBe("admin-1");
  });

  // === Error handling ===

  it("returns 500 on Cosmos DB error", async () => {
    mockUsersFetchAll.mockRejectedValue(new Error("Cosmos connection failed"));
    const req = createMockRequest({
      body: { scope: "all" },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
    expect((res.jsonBody as any).error).toContain("Failed to reset scores");
  });
});
