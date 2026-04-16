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

const EXISTING_USER = {
  id: "user-existing",
  userId: "user-existing",
  email: "existing@example.com",
  displayName: "ExistingPlayer",
  isActive: true,
  isAdmin: false,
  totalScore: 100,
  gamesPlayed: 5,
  fastestTimeMs: 3000,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
};

const INACTIVE_USER = {
  ...EXISTING_USER,
  id: "user-inactive",
  userId: "user-inactive",
  email: "inactive@example.com",
  isActive: false,
};

const LEGACY_USER = {
  id: "legacy-123",
  userId: "legacy-123",
  displayName: "OldPlayer",
  isActive: true,
  isAdmin: false,
  totalScore: 200,
  gamesPlayed: 10,
  fastestTimeMs: 1500,
  createdAt: "2023-01-01T00:00:00Z",
  updatedAt: "2023-06-01T00:00:00Z",
};

beforeAll(async () => {
  await import("../loginOrCreate.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("loginOrCreate", () => {
  const mockQuery = vi.fn();
  const mockRead = vi.fn();
  const mockReplace = vi.fn();
  const mockCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersContainer.items.query).mockReturnValue({
      fetchAll: mockQuery,
    } as any);
    vi.mocked(usersContainer.item).mockReturnValue({
      read: mockRead,
      replace: mockReplace,
    } as any);
    vi.mocked(usersContainer.items.create).mockImplementation(mockCreate);
  });

  it("creates a new user with valid email and displayName → 201", async () => {
    mockQuery.mockResolvedValue({ resources: [] });
    mockCreate.mockResolvedValue({});
    const req = createMockRequest({
      body: { email: "new@example.com", displayName: "NewPlayer" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(201);
    expect((res.jsonBody as any).email).toBe("new@example.com");
    expect((res.jsonBody as any).displayName).toBe("NewPlayer");
    expect((res.jsonBody as any).isActive).toBe(true);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("returns existing user when email already in DB → 200", async () => {
    mockQuery.mockResolvedValue({ resources: [EXISTING_USER] });
    const req = createMockRequest({
      body: { email: "existing@example.com", displayName: "Whatever" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).userId).toBe("user-existing");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when existing user is inactive", async () => {
    mockQuery.mockResolvedValue({ resources: [INACTIVE_USER] });
    const req = createMockRequest({
      body: { email: "inactive@example.com", displayName: "Whatever" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(403);
    expect((res.jsonBody as any).error).toContain("inactive");
  });

  it("returns 400 for invalid email format", async () => {
    const req = createMockRequest({
      body: { email: "not-an-email", displayName: "Player" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("email");
  });

  it("returns existing user with empty displayName (returning user) → 200", async () => {
    mockQuery.mockResolvedValue({ resources: [EXISTING_USER] });
    const req = createMockRequest({
      body: { email: "existing@example.com", displayName: "" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).userId).toBe("user-existing");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for displayName too short", async () => {
    mockQuery.mockResolvedValue({ resources: [] });
    const req = createMockRequest({
      body: { email: "ok@example.com", displayName: "A" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("displayName");
  });

  it("returns 400 for displayName too long", async () => {
    mockQuery.mockResolvedValue({ resources: [] });
    const req = createMockRequest({
      body: { email: "ok@example.com", displayName: "A".repeat(31) },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("displayName");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = createMockRequest({ bodyError: true });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("Invalid JSON");
  });

  it("links legacy user when x-legacy-user-id header provided → 200", async () => {
    mockQuery.mockResolvedValue({ resources: [] });
    mockRead.mockResolvedValue({ resource: LEGACY_USER });
    mockReplace.mockResolvedValue({});
    const req = createMockRequest({
      body: { email: "linked@example.com", displayName: "LinkedPlayer" },
      headers: { "x-legacy-user-id": "legacy-123" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).email).toBe("linked@example.com");
    expect((res.jsonBody as any).displayName).toBe("LinkedPlayer");
    expect(mockReplace).toHaveBeenCalledOnce();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("falls through to create when legacy user not found", async () => {
    mockQuery.mockResolvedValue({ resources: [] });
    mockRead.mockRejectedValue(new Error("Not Found"));
    mockCreate.mockResolvedValue({});
    const req = createMockRequest({
      body: { email: "fallback@example.com", displayName: "FallbackPlayer" },
      headers: { "x-legacy-user-id": "nonexistent-legacy" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(201);
    expect((res.jsonBody as any).email).toBe("fallback@example.com");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("returns 500 on unexpected Cosmos error", async () => {
    mockQuery.mockRejectedValue(new Error("Connection timeout"));
    const req = createMockRequest({
      body: { email: "boom@example.com", displayName: "BoomPlayer" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
    expect((res.jsonBody as any).error).toContain("Failed to login or create");
  });
});
