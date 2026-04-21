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
  categoryScoresContainer: {
    item: vi.fn(),
    items: { upsert: vi.fn() },
  },
  gameStateContainer: {
    item: vi.fn(() => ({
      read: vi.fn().mockResolvedValue({
        resource: { id: "current", partitionKey: "current", timerSeconds: 10 },
      }),
    })),
    items: { upsert: vi.fn() },
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
import { questionsContainer, gameStateContainer } from "../../services/cosmosClient.js";
import { getDeliveryTimestamp, clearDelivery } from "../../services/questionDeliveryTracker.js";
import { updateUserScore } from "../../services/scoringService.js";
import { getTopLeaderboard } from "../../services/leaderboardService.js";
import { _resetSubmitAnswerCaches } from "../submitAnswer.js";

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
    _resetSubmitAnswerCaches();
    vi.mocked(questionsContainer.items.query).mockReturnValue({
      fetchAll: mockFetchAll,
    } as any);
    mockFetchAll.mockResolvedValue({ resources: [SAMPLE_QUESTION] });
    vi.mocked(getDeliveryTimestamp).mockReturnValue(undefined);
    vi.mocked(updateUserScore).mockResolvedValue(undefined);
    vi.mocked(getTopLeaderboard).mockResolvedValue([]);

    // Default: gameState returns timerSeconds=10 (10s timeout → 10000ms)
    vi.mocked(gameStateContainer.item).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: { id: "current", partitionKey: "current", timerSeconds: 10 },
      }),
    } as any);
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

  // === Point calculation (linear time-based scoring) ===
  // Formula: score = max(0, round(200 × (1 - elapsedTimeMs / timeoutMs)))

  it("awards 0 points for incorrect answers", async () => {
    const req = createMockRequest({ body: validBody({ selectedOption: 3 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect((res.jsonBody as any).pointsAwarded).toBe(0);
  });

  it("awards 200 points for instant answer (0ms)", async () => {
    const now = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now); // 0ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // 200 × (1 - 0/10000) = 200
    expect((res.jsonBody as any).pointsAwarded).toBe(200);
  });

  it("awards 160 points for 2s answer with 10s timeout", async () => {
    const now = 1700000002000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 2000); // 2000ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // 200 × (1 - 2000/10000) = 200 × 0.8 = 160
    expect((res.jsonBody as any).pointsAwarded).toBe(160);
  });

  it("awards 100 points for half-timeout answer", async () => {
    const now = 1700000005000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 5000); // 5000ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // 200 × (1 - 5000/10000) = 200 × 0.5 = 100
    expect((res.jsonBody as any).pointsAwarded).toBe(100);
  });

  it("awards 0 points at timeout boundary", async () => {
    const now = 1700000010000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 10000); // 10000ms elapsed = full timeout

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // 200 × (1 - 10000/10000) = 200 × 0 = 0
    expect((res.jsonBody as any).pointsAwarded).toBe(0);
  });

  it("awards 0 points when answer exceeds timeout", async () => {
    const now = 1700000015000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 15000); // 15000ms elapsed > timeout

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // max(0, 200 × (1 - 15000/10000)) = max(0, -100) = 0
    expect((res.jsonBody as any).pointsAwarded).toBe(0);
  });

  it("respects custom timerSeconds from GameState", async () => {
    // Override gameState to 30s timeout
    vi.mocked(gameStateContainer.item).mockReturnValue({
      read: vi.fn().mockResolvedValue({
        resource: { id: "current", partitionKey: "current", timerSeconds: 30 },
      }),
    } as any);

    const now = 1700000015000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 15000); // 15000ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // 200 × (1 - 15000/30000) = 200 × 0.5 = 100
    expect((res.jsonBody as any).pointsAwarded).toBe(100);
  });

  it("uses default 10s timeout when GameState unavailable", async () => {
    // Simulate gameState read failure
    vi.mocked(gameStateContainer.item).mockReturnValue({
      read: vi.fn().mockRejectedValue(new Error("Not found")),
    } as any);

    const now = 1700000005000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(getDeliveryTimestamp).mockReturnValue(now - 5000); // 5000ms elapsed

    const req = createMockRequest({ body: validBody({ selectedOption: 0 }) });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    // Default 10s timeout: 200 × (1 - 5000/10000) = 100
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
