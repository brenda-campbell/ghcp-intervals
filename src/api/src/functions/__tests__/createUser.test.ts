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

beforeAll(async () => {
  await import("../createUser.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersContainer.items.create).mockResolvedValue({} as any);
  });

  it("creates user with auto-generated name when no body", async () => {
    const req = createMockRequest({ bodyError: true });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(201);
    const user = res.jsonBody as any;
    expect(user.displayName).toMatch(/^Player-\d{4}$/);
    expect(user.userId).toBeDefined();
    expect(user.id).toBe(user.userId);
    expect(user.totalScore).toBe(0);
    expect(user.gamesPlayed).toBe(0);
  });

  it("creates user with provided displayName", async () => {
    const req = createMockRequest({
      body: { displayName: "TestPlayer" },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(201);
    expect((res.jsonBody as any).displayName).toBe("TestPlayer");
  });

  it("trims whitespace from displayName", async () => {
    const req = createMockRequest({
      body: { displayName: "  Spacey  " },
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(201);
    expect((res.jsonBody as any).displayName).toBe("Spacey");
  });

  it("falls back to generated name for empty displayName", async () => {
    const req = createMockRequest({ body: { displayName: "" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(201);
    expect((res.jsonBody as any).displayName).toMatch(/^Player-\d{4}$/);
  });

  it("falls back to generated name for whitespace-only displayName", async () => {
    const req = createMockRequest({ body: { displayName: "   " } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(201);
    expect((res.jsonBody as any).displayName).toMatch(/^Player-\d{4}$/);
  });

  it("sets initial timestamps", async () => {
    const req = createMockRequest({ bodyError: true });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(201);
    const user = res.jsonBody as any;
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
    expect(user.createdAt).toBe(user.updatedAt);
  });

  it("calls Cosmos DB create with user document", async () => {
    const req = createMockRequest({ body: { displayName: "Bob" } });
    const ctx = createMockContext();

    await handler(req, ctx);

    expect(usersContainer.items.create).toHaveBeenCalledOnce();
    const created = vi.mocked(usersContainer.items.create).mock.calls[0][0] as any;
    expect(created.displayName).toBe("Bob");
    expect(created.totalScore).toBe(0);
  });

  it("returns 500 on Cosmos DB error", async () => {
    vi.mocked(usersContainer.items.create).mockRejectedValue(
      new Error("DB error")
    );
    const req = createMockRequest({ bodyError: true });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
    expect((res.jsonBody as any).error).toContain("Failed to create user");
  });
});
