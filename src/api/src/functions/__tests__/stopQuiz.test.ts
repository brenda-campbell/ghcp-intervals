import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type { HttpResponseInit } from "@azure/functions";
import { createMockRequest, createMockContext } from "../../__tests__/helpers.js";

vi.mock("@azure/functions", () => ({
  app: { http: vi.fn() },
  output: { generic: vi.fn(() => "mockSignalROutput") },
  input: { generic: vi.fn(() => "mockSignalRInput") },
}));

vi.mock("../../services/cosmosClient.js", () => ({
  gameStateContainer: {
    item: vi.fn(),
    items: { upsert: vi.fn() },
  },
  usersContainer: {
    item: vi.fn(),
    items: { query: vi.fn() },
  },
  database: {},
}));

vi.mock("../../services/adminAuth.js", () => ({
  requireAdmin: vi.fn(),
}));

import { app } from "@azure/functions";
import { gameStateContainer } from "../../services/cosmosClient.js";
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

const EXISTING_GAME_STATE = {
  id: "current",
  activeCategoryId: "cat-azure",
  activeCategoryName: "Azure Fundamentals",
  activeQuestionFormat: "multiple-choice" as const,
  isStarted: true,
  updatedAt: "2024-06-01T10:00:00Z",
  updatedBy: "admin-1",
};

beforeAll(async () => {
  await import("../stopQuiz.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("stopQuiz", () => {
  const mockRead = vi.fn();
  const mockUpsert = vi.mocked(gameStateContainer.items.upsert);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER as any);
    vi.mocked(gameStateContainer.item).mockReturnValue({
      read: mockRead,
    } as any);
    mockRead.mockResolvedValue({ resource: { ...EXISTING_GAME_STATE } });
    mockUpsert.mockImplementation(async (doc: any) => ({ resource: doc } as any));
  });

  // === Auth ===

  it("returns 401 when x-user-id header is missing", async () => {
    vi.mocked(requireAdmin).mockRejectedValue({
      status: 401,
      message: "Missing x-user-id header",
    });
    const req = createMockRequest({ headers: {} });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(401);
    expect((res.jsonBody as any).error).toContain("x-user-id");
  });

  it("returns 403 for non-admin callers", async () => {
    vi.mocked(requireAdmin).mockRejectedValue({
      status: 403,
      message: "Admin access required",
    });
    const req = createMockRequest({
      headers: { "x-user-id": "regular-user" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(403);
    expect((res.jsonBody as any).error).toContain("Admin");
  });

  // === Happy path ===

  it("returns 200 and sets isStarted=false on success", async () => {
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).isStarted).toBe(false);
  });

  it("preserves existing game state fields", async () => {
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    const body = res.jsonBody as any;
    expect(body.activeCategoryId).toBe("cat-azure");
    expect(body.activeCategoryName).toBe("Azure Fundamentals");
    expect(body.activeQuestionFormat).toBe("multiple-choice");
  });

  it("returns the updated game state with updatedAt and updatedBy", async () => {
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    const body = res.jsonBody as any;
    expect(body.id).toBe("current");
    expect(body.updatedBy).toBe("admin-1");
    expect(body.updatedAt).toBeDefined();
  });

  it("upserts the game state to Cosmos with isStarted=false", async () => {
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    await handler(req, ctx);

    expect(mockUpsert).toHaveBeenCalledOnce();
    const upsertedDoc = mockUpsert.mock.calls[0][0] as any;
    expect(upsertedDoc.isStarted).toBe(false);
    expect(upsertedDoc.id).toBe("current");
  });

  // === SignalR broadcast ===

  it("sets SignalR output with quizStopped event", async () => {
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    await handler(req, ctx);

    expect(ctx.extraOutputs.set).toHaveBeenCalled();
    const messages = (ctx.extraOutputs.set as any).mock.calls[0][1];
    const stoppedMsg = Array.isArray(messages)
      ? messages.find((m: any) => m.target === "quizStopped")
      : messages.target === "quizStopped"
        ? messages
        : undefined;
    expect(stoppedMsg).toBeDefined();
  });

  // === Cosmos error ===

  it("returns 500 on Cosmos upsert error", async () => {
    mockUpsert.mockRejectedValue(new Error("Cosmos write failed"));
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
  });

  // === Idempotency ===

  it("handles case where quiz is already stopped (idempotent)", async () => {
    mockRead.mockResolvedValue({
      resource: { ...EXISTING_GAME_STATE, isStarted: false },
    });
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).isStarted).toBe(false);
  });

  // === No existing game state ===

  it("returns 400 when no game state exists (Cosmos 404)", async () => {
    mockRead.mockRejectedValue({ code: 404 });
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("category");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 when read returns undefined resource", async () => {
    mockRead.mockResolvedValue({ resource: undefined });
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("category");
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
