import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type { HttpResponseInit } from "@azure/functions";
import { createMockRequest, createMockContext } from "../../__tests__/helpers.js";

vi.mock("@azure/functions", () => ({
  app: { http: vi.fn() },
  output: { generic: vi.fn(() => "mockSignalROutput") },
  input: { generic: vi.fn(() => "mockSignalRInput") },
}));

vi.mock("../../services/cosmosClient", () => ({
  questionsContainer: {
    items: { query: vi.fn() },
  },
  usersContainer: {
    item: vi.fn(),
    items: { create: vi.fn(), query: vi.fn() },
  },
  database: {},
}));

import { app } from "@azure/functions";
import { usersContainer } from "../../services/cosmosClient";

type Handler = (req: any, ctx: any) => Promise<HttpResponseInit>;
let handler: Handler;

const SAMPLE_USER = {
  id: "user-123",
  userId: "user-123",
  displayName: "Player-1234",
  totalScore: 500,
  gamesPlayed: 10,
  fastestTimeMs: 2000,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
};

beforeAll(async () => {
  await import("../getUser.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("getUser", () => {
  const mockRead = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersContainer.item).mockReturnValue({
      read: mockRead,
    } as any);
  });

  it("returns user by ID", async () => {
    mockRead.mockResolvedValue({ resource: SAMPLE_USER });
    const req = createMockRequest({ params: { userId: "user-123" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).userId).toBe("user-123");
    expect((res.jsonBody as any).displayName).toBe("Player-1234");
    expect(usersContainer.item).toHaveBeenCalledWith("user-123", "user-123");
  });

  it("returns 404 when user not found (resource is undefined)", async () => {
    mockRead.mockResolvedValue({ resource: undefined });
    const req = createMockRequest({ params: { userId: "no-such-user" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(404);
    expect((res.jsonBody as any).error).toContain("User not found");
  });

  it("returns 404 when Cosmos throws a 404 error", async () => {
    const cosmosError = Object.assign(new Error("Not Found"), { code: 404 });
    mockRead.mockRejectedValue(cosmosError);
    const req = createMockRequest({ params: { userId: "ghost" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(404);
    expect((res.jsonBody as any).error).toContain("User not found");
  });

  it("returns 400 when userId param is missing", async () => {
    const req = createMockRequest({ params: {} });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("Missing userId");
  });

  it("returns 500 on unexpected Cosmos DB error", async () => {
    mockRead.mockRejectedValue(new Error("Connection timeout"));
    const req = createMockRequest({ params: { userId: "user-1" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
    expect((res.jsonBody as any).error).toContain("Failed to fetch user");
  });
});
