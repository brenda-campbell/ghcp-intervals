import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
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

vi.mock("../../services/questionDeliveryTracker.js", () => ({
  getDeliveryTimestamp: vi.fn(),
  clearDelivery: vi.fn(),
  recordDelivery: vi.fn(),
}));

vi.mock("../../services/scoringService.js", () => ({
  updateUserScore: vi.fn(),
}));

vi.mock("../../services/leaderboardService.js", () => ({
  getTopLeaderboard: vi.fn(),
}));

import { app } from "@azure/functions";
import { questionsContainer } from "../../services/cosmosClient.js";
import { getDeliveryTimestamp, clearDelivery } from "../../services/questionDeliveryTracker.js";
import { updateUserScore } from "../../services/scoringService.js";
import { getTopLeaderboard } from "../../services/leaderboardService.js";

type Handler = (req: any, ctx: any) => Promise<HttpResponseInit>;
let handler: Handler;

const SAMPLE_QUESTION = {
  id: "q1",
  category: "Azure",
  questionText: "What is Azure?",
  options: ["Cloud", "Database", "Language", "Framework"] as [string, string, string, string],
  correctIndex: 0,
  difficulty: "easy",
};

beforeAll(async () => {
  await import("../submitAnswer.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("submitAnswer", () => {
  const mockFetchAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(questionsContainer.items.query).mockReturnValue({
      fetchAll: mockFetchAll,
    } as any);
    mockFetchAll.mockResolvedValue({ resources: [SAMPLE_QUESTION] });
    vi.mocked(getDeliveryTimestamp).mockReturnValue(undefined);
    vi.mocked(updateUserScore).mockResolvedValue(undefined);
    vi.mocked(getTopLeaderboard).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      questionId: "q1",
      selectedOption: 0,
      userId: "user-1",
      clientTimestamp: Date.now() - 2000,
      ...overrides,
    };
  }

  // === Correct / Incorrect answers ===

  it("returns correct=true for correct answer", async () => {
    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).correct).toBe(true);
    expect((res.jsonBody as any).correctAnswer).toBe("Cloud");
  });

  it("returns correct=false for wrong answer", async () => {
    const req = createMockRequest({ body: validBody({ selectedOption: 2 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).correct).toBe(false);
    expect((res.jsonBody as any).correctAnswer).toBe("Cloud");
  });

  // === Point calculation ===

  it("awards 0 points for incorrect answers", async () => {
    const req = createMockRequest({ body: validBody({ selectedOption: 3 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect((res.jsonBody as any).pointsAwarded).toBe(0);
  });

  it("awards BASE + MAX_SPEED_BONUS for instant answer (0ms)", async () => {
    const now = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now); // 0ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // BASE=100 + MAX_SPEED_BONUS=100 = 200
    expect((res.jsonBody as any).pointsAwarded).toBe(200);
  });

  it("awards BASE points only at timeout (10s)", async () => {
    const now = 1700000010000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 10000); // 10000ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // BASE=100 + speedBonus=0 = 100
    expect((res.jsonBody as any).pointsAwarded).toBe(100);
  });

  it("awards proportional speed bonus for 5s answer", async () => {
    const now = 1700000005000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 5000); // 5000ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // BASE=100 + round(100*(1 - 5000/10000)) = 100 + 50 = 150
    expect((res.jsonBody as any).pointsAwarded).toBe(150);
  });

  it("clamps very long response times (>10s) to timeout", async () => {
    const now = 1700000020000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 20000); // 20000ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // clamped to 10000ms → BASE=100 + 0 = 100
    expect((res.jsonBody as any).pointsAwarded).toBe(100);
  });

  // === Validation errors (400) ===

  it("returns 400 for invalid JSON body", async () => {
    const req = createMockRequest({ bodyError: true });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("Invalid JSON");
  });

  it("returns 400 for missing questionId", async () => {
    const req = createMockRequest({
      body: validBody({ questionId: undefined }),
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("questionId");
  });

  it("returns 400 for missing userId", async () => {
    const req = createMockRequest({
      body: validBody({ userId: undefined }),
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("userId");
  });

  it("returns 400 for non-integer selectedOption", async () => {
    const req = createMockRequest({
      body: validBody({ selectedOption: 1.5 }),
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("selectedOption");
  });

  it("returns 400 for selectedOption out of range (>3)", async () => {
    const req = createMockRequest({
      body: validBody({ selectedOption: 4 }),
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("selectedOption");
  });

  it("returns 400 for negative selectedOption", async () => {
    const req = createMockRequest({
      body: validBody({ selectedOption: -1 }),
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("selectedOption");
  });

  it("returns 400 for string selectedOption", async () => {
    const req = createMockRequest({
      body: validBody({ selectedOption: "two" }),
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
  });

  // === 404 ===

  it("returns 404 for non-existent question", async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });
    const req = createMockRequest({ body: validBody() });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(404);
    expect((res.jsonBody as any).error).toContain("Question not found");
  });

  // === Delivery tracker ===

  it("uses server-side delivery timestamp when available", async () => {
    const now = 1700000003000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 3000);

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect((res.jsonBody as any).elapsedTimeMs).toBe(3000);
    expect(clearDelivery).toHaveBeenCalledWith("q1", "user-1");
  });

  it("falls back to clientTimestamp when no delivery record", async () => {
    vi.mocked(getDeliveryTimestamp).mockReturnValue(undefined);
    const now = 1700000002000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const req = createMockRequest({
      body: validBody({ clientTimestamp: now - 1500 }),
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect((res.jsonBody as any).elapsedTimeMs).toBe(1500);
  });

  it("double-submit: second submit has no delivery record, falls back", async () => {
    vi.mocked(getDeliveryTimestamp).mockReturnValue(undefined);
    const now = 1700000002000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const req = createMockRequest({
      body: validBody({ clientTimestamp: now - 500 }),
    });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).elapsedTimeMs).toBe(500);
  });

  // === Score update resilience ===

  it("returns answer result even if score update fails", async () => {
    vi.mocked(updateUserScore).mockRejectedValue(new Error("DB write failed"));
    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).correct).toBe(true);
  });

  // === SignalR broadcast ===

  it("sets SignalR messages on extraOutputs", async () => {
    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect(ctx.extraOutputs.set).toHaveBeenCalled();
    const messages = (ctx.extraOutputs.set as any).mock.calls[0][1];
    expect(messages.some((m: any) => m.target === "playerAnswered")).toBe(true);
    expect(messages.some((m: any) => m.target === "leaderboardUpdate")).toBe(true);
  });

  it("still returns result if leaderboard broadcast fails", async () => {
    vi.mocked(getTopLeaderboard).mockRejectedValue(new Error("LB failed"));
    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
  });

  // === Cosmos DB error ===

  it("returns 500 on Cosmos DB query error", async () => {
    mockFetchAll.mockRejectedValue(new Error("DB error"));
    const req = createMockRequest({ body: validBody() });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
  });
});
