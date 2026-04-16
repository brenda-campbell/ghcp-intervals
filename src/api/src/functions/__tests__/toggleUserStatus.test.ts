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

vi.mock("../../services/adminAuth", () => ({
  requireAdmin: vi.fn(),
}));

import { app } from "@azure/functions";
import { usersContainer } from "../../services/cosmosClient";
import { requireAdmin } from "../../services/adminAuth";

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

const TARGET_USER = {
  id: "target-1",
  userId: "target-1",
  email: "target@example.com",
  displayName: "TargetPlayer",
  isActive: true,
  isAdmin: false,
  totalScore: 50,
  gamesPlayed: 3,
  fastestTimeMs: 4000,
  createdAt: "2024-02-01T00:00:00Z",
  updatedAt: "2024-02-01T00:00:00Z",
};

beforeAll(async () => {
  await import("../toggleUserStatus.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("toggleUserStatus", () => {
  const mockRead = vi.fn();
  const mockReplace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER as any);
    vi.mocked(usersContainer.item).mockReturnValue({
      read: mockRead,
      replace: mockReplace,
    } as any);
  });

  it("deactivates a user → 200", async () => {
    mockRead.mockResolvedValue({ resource: TARGET_USER });
    mockReplace.mockResolvedValue({});
    const req = createMockRequest({
      params: { userId: "target-1" },
      body: { isActive: false },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).isActive).toBe(false);
    expect(mockReplace).toHaveBeenCalledOnce();
  });

  it("activates a user → 200", async () => {
    const inactiveTarget = { ...TARGET_USER, isActive: false };
    mockRead.mockResolvedValue({ resource: inactiveTarget });
    mockReplace.mockResolvedValue({});
    const req = createMockRequest({
      params: { userId: "target-1" },
      body: { isActive: true },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).isActive).toBe(true);
  });

  it("returns 400 when trying to deactivate self", async () => {
    const req = createMockRequest({
      params: { userId: "admin-1" },
      body: { isActive: false },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("own account");
  });

  it("returns 400 when missing userId param", async () => {
    const req = createMockRequest({
      params: {},
      body: { isActive: true },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("Missing userId");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = createMockRequest({
      params: { userId: "target-1" },
      bodyError: true,
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("Invalid JSON");
  });

  it("returns 400 when isActive not boolean", async () => {
    const req = createMockRequest({
      params: { userId: "target-1" },
      body: { isActive: "yes" },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("isActive");
  });

  it("returns 404 when target user not found", async () => {
    mockRead.mockResolvedValue({ resource: undefined });
    const req = createMockRequest({
      params: { userId: "nonexistent" },
      body: { isActive: false },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(404);
    expect((res.jsonBody as any).error).toContain("User not found");
  });

  it("returns 401 when x-user-id header missing", async () => {
    vi.mocked(requireAdmin).mockRejectedValue({
      status: 401,
      message: "Missing x-user-id header",
    });
    const req = createMockRequest({
      params: { userId: "target-1" },
      body: { isActive: false },
    });
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
      params: { userId: "target-1" },
      body: { isActive: false },
      headers: { "x-user-id": "user-regular" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(403);
    expect((res.jsonBody as any).error).toContain("Admin");
  });

  it("returns 500 on unexpected error", async () => {
    mockRead.mockRejectedValue(new Error("Connection timeout"));
    const req = createMockRequest({
      params: { userId: "target-1" },
      body: { isActive: true },
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
    expect((res.jsonBody as any).error).toContain("Failed to update user status");
  });
});
