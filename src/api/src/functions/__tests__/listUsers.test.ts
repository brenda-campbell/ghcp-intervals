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

const SAMPLE_USERS = [
  ADMIN_USER,
  {
    id: "user-2",
    userId: "user-2",
    email: "player@example.com",
    displayName: "Player",
    isActive: true,
    isAdmin: false,
    totalScore: 50,
    gamesPlayed: 2,
    fastestTimeMs: 5000,
    createdAt: "2024-02-01T00:00:00Z",
    updatedAt: "2024-02-01T00:00:00Z",
  },
];

beforeAll(async () => {
  await import("../listUsers.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("listUsers", () => {
  const mockQuery = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersContainer.items.query).mockReturnValue({
      fetchAll: mockQuery,
    } as any);
  });

  it("returns all users when called by admin → 200", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER as any);
    mockQuery.mockResolvedValue({ resources: SAMPLE_USERS });
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).users).toHaveLength(2);
  });

  it("returns 401 when x-user-id header missing", async () => {
    vi.mocked(requireAdmin).mockRejectedValue({
      status: 401,
      message: "Missing x-user-id header",
    });
    const req = createMockRequest();
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
      headers: { "x-user-id": "user-2" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(403);
    expect((res.jsonBody as any).error).toContain("Admin");
  });

  it("returns 500 on Cosmos error", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER as any);
    mockQuery.mockRejectedValue(new Error("Connection failed"));
    const req = createMockRequest({
      headers: { "x-user-id": "admin-1" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
    expect((res.jsonBody as any).error).toContain("Failed to list users");
  });
});
