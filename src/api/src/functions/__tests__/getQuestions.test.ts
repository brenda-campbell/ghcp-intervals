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

import { app } from "@azure/functions";
import { questionsContainer } from "../../services/cosmosClient.js";

type Handler = (req: any, ctx: any) => Promise<HttpResponseInit>;
let handler: Handler;

const SAMPLE_QUESTIONS = [
  {
    id: "q1",
    category: "Azure",
    questionText: "What is Azure?",
    options: ["A", "B", "C", "D"] as [string, string, string, string],
    correctIndex: 2,
    difficulty: "easy",
  },
  {
    id: "q2",
    category: "GitHub",
    questionText: "What is GitHub?",
    options: ["W", "X", "Y", "Z"] as [string, string, string, string],
    correctIndex: 0,
    difficulty: "medium",
  },
  {
    id: "q3",
    category: "Azure",
    questionText: "What is Cosmos DB?",
    options: ["P", "Q", "R", "S"] as [string, string, string, string],
    correctIndex: 1,
    difficulty: "hard",
  },
];

beforeAll(async () => {
  await import("../getQuestions.js");
  handler = vi.mocked(app.http).mock.calls[0][1].handler;
});

describe("getQuestions", () => {
  const mockFetchAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(questionsContainer.items.query).mockReturnValue({
      fetchAll: mockFetchAll,
    } as any);
    // Re-register so app.http mock calls don't interfere
    vi.mocked(app.http).mockClear();
  });

  it("returns questions without correctIndex", async () => {
    mockFetchAll.mockResolvedValue({ resources: SAMPLE_QUESTIONS });
    const req = createMockRequest({ query: { count: "1" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    const body = res.jsonBody as any;
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0]).not.toHaveProperty("correctIndex");
    expect(body.questions[0]).toHaveProperty("difficulty");
    expect(body.questions[0]).toHaveProperty("id");
    expect(body.questions[0]).toHaveProperty("questionText");
    expect(body.questions[0]).toHaveProperty("options");
  });

  it("returns correct count of questions", async () => {
    mockFetchAll.mockResolvedValue({ resources: SAMPLE_QUESTIONS });
    const req = createMockRequest({ query: { count: "2" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).questions).toHaveLength(2);
  });

  it("defaults to 1 question when count not specified", async () => {
    mockFetchAll.mockResolvedValue({ resources: SAMPLE_QUESTIONS });
    const req = createMockRequest();
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).questions).toHaveLength(1);
  });

  it("returns a roundId", async () => {
    mockFetchAll.mockResolvedValue({ resources: SAMPLE_QUESTIONS });
    const req = createMockRequest({ query: { count: "1" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as any).roundId).toBeDefined();
    expect(typeof (res.jsonBody as any).roundId).toBe("string");
  });

  it("returns all questions from the pool (not duplicates)", async () => {
    mockFetchAll.mockResolvedValue({ resources: SAMPLE_QUESTIONS });
    const req = createMockRequest({ query: { count: "3" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    const ids = (res.jsonBody as any).questions.map((q: any) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  // Edge cases
  it("returns 400 for count=0", async () => {
    const req = createMockRequest({ query: { count: "0" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("Invalid count");
  });

  it("returns 400 for negative count", async () => {
    const req = createMockRequest({ query: { count: "-1" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
  });

  it("returns 400 for count exceeding MAX_QUESTIONS (3)", async () => {
    const req = createMockRequest({ query: { count: "4" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain("Invalid count");
  });

  it("returns 400 for non-numeric count", async () => {
    const req = createMockRequest({ query: { count: "abc" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(400);
  });

  it("returns 404 when no questions exist", async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });
    const req = createMockRequest({ query: { count: "1" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(404);
    expect((res.jsonBody as any).error).toContain("No questions available");
  });

  it("returns 404 when fewer questions than requested", async () => {
    mockFetchAll.mockResolvedValue({
      resources: [SAMPLE_QUESTIONS[0]],
    });
    const req = createMockRequest({ query: { count: "3" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(404);
    expect((res.jsonBody as any).error).toContain("Not enough questions");
  });

  it("returns 500 on Cosmos DB error", async () => {
    mockFetchAll.mockRejectedValue(new Error("DB connection failed"));
    const req = createMockRequest({ query: { count: "1" } });
    const ctx = createMockContext();

    const res = await handler(req, ctx);

    expect(res.status).toBe(500);
    expect((res.jsonBody as any).error).toBe("Internal server error.");
  });
});
