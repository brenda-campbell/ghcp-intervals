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
  questionsContainer: {
    items: { query: vi.fn() },
  },
  usersContainer: {
    item: vi.fn(),
    items: { query: vi.fn() },
  },
  categoriesContainer: {
    item: vi.fn(),
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
  gameStateContainer,
  questionsContainer,
  categoriesContainer,
} from "../../services/cosmosClient.js";
import { requireAdmin } from "../../services/adminAuth.js";

type Handler = (req: any, ctx: any) => Promise<HttpResponseInit>;
let startQuizHandler: Handler;
let getQuestionsHandler: Handler;
let stopQuizHandler: Handler;
let setCategoryHandler: Handler;

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

const QUESTION_POOL = [
  {
    id: "q1",
    category: "cat-azure",
    questionText: "What is Azure?",
    options: ["A", "B", "C", "D"],
    correctIndex: 0,
    difficulty: "easy",
    type: "multiple-choice",
  },
  {
    id: "q2",
    category: "cat-azure",
    questionText: "What is Cosmos DB?",
    options: ["W", "X", "Y", "Z"],
    correctIndex: 1,
    difficulty: "medium",
    type: "multiple-choice",
  },
  {
    id: "q3",
    category: "cat-azure",
    questionText: "What is Functions?",
    options: ["P", "Q", "R", "S"],
    correctIndex: 2,
    difficulty: "hard",
    type: "multiple-choice",
  },
  {
    id: "q4",
    category: "cat-azure",
    questionText: "What is App Service?",
    options: ["J", "K", "L", "M"],
    correctIndex: 3,
    difficulty: "easy",
    type: "multiple-choice",
  },
];

const BASE_GAME_STATE = {
  id: "current",
  activeCategoryId: "cat-azure",
  activeCategoryName: "Azure Fundamentals",
  activeQuestionFormat: "multiple-choice" as const,
  isStarted: false,
  questionIds: [] as string[],
  updatedAt: "2024-06-01T10:00:00Z",
  updatedBy: "admin-1",
};

const ACTIVE_CATEGORY = {
  id: "cat-github",
  name: "GitHub Copilot",
  description: "GitHub questions",
  isActive: true,
  questionFormat: "multiple-choice" as const,
  createdAt: "2024-01-01T00:00:00Z",
};

beforeAll(async () => {
  await import("../startQuiz.js");
  await import("../getQuestions.js");
  await import("../stopQuiz.js");
  await import("../setCategory.js");

  const calls = vi.mocked(app.http).mock.calls;
  startQuizHandler = calls.find((c) => c[0] === "startQuiz")![1].handler;
  getQuestionsHandler = calls.find((c) => c[0] === "getQuestions")![1].handler;
  stopQuizHandler = calls.find((c) => c[0] === "stopQuiz")![1].handler;
  setCategoryHandler = calls.find((c) => c[0] === "setCategory")![1].handler;
});

describe("Synchronized questions", () => {
  const mockGameStateRead = vi.fn();
  const mockGameStateUpsert = vi.mocked(gameStateContainer.items.upsert);
  const mockQuestionsFetchAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER as any);

    // gameStateContainer.item("current","current").read()
    vi.mocked(gameStateContainer.item).mockReturnValue({
      read: mockGameStateRead,
    } as any);

    mockGameStateUpsert.mockImplementation(
      async (doc: any) => ({ resource: doc }) as any
    );

    // questionsContainer.items.query().fetchAll()
    vi.mocked(questionsContainer.items.query).mockReturnValue({
      fetchAll: mockQuestionsFetchAll,
    } as any);
  });

  // === startQuiz pins questions ===

  describe("startQuiz pins questions", () => {
    beforeEach(() => {
      mockGameStateRead.mockResolvedValue({
        resource: { ...BASE_GAME_STATE },
      });
      mockQuestionsFetchAll.mockResolvedValue({
        resources: [...QUESTION_POOL],
      });
    });

    it("selects questions from active category and stores questionIds on GameState", async () => {
      const req = createMockRequest({
        headers: { "x-user-id": "admin-1" },
      });
      const ctx = createMockContext();

      const res = await startQuizHandler(req, ctx);

      expect(res.status).toBe(200);
      expect(mockGameStateUpsert).toHaveBeenCalledOnce();
      const upserted = mockGameStateUpsert.mock.calls[0][0] as any;
      expect(upserted.questionIds).toBeDefined();
      expect(Array.isArray(upserted.questionIds)).toBe(true);
      // Each pinned ID must come from the question pool
      for (const id of upserted.questionIds) {
        expect(QUESTION_POOL.map((q) => q.id)).toContain(id);
      }
    });

    it("pins exactly 3 questions (QUESTION_COUNT)", async () => {
      const req = createMockRequest({
        headers: { "x-user-id": "admin-1" },
      });
      const ctx = createMockContext();

      const res = await startQuizHandler(req, ctx);

      expect(res.status).toBe(200);
      const upserted = mockGameStateUpsert.mock.calls[0][0] as any;
      expect(upserted.questionIds).toHaveLength(3);
    });
  });

  // === getQuestions returns pinned questions ===

  describe("getQuestions returns pinned questions", () => {
    it("returns exact pinned questions when quiz isStarted and questionIds exist", async () => {
      const pinnedIds = ["q1", "q2", "q3"];
      mockGameStateRead.mockResolvedValue({
        resource: {
          ...BASE_GAME_STATE,
          isStarted: true,
          questionIds: pinnedIds,
        },
      });
      // Simulate Cosmos returning the pinned questions (possibly out of order)
      mockQuestionsFetchAll.mockResolvedValue({
        resources: [QUESTION_POOL[2], QUESTION_POOL[0], QUESTION_POOL[1]],
      });

      const req = createMockRequest();
      const ctx = createMockContext();

      const res = await getQuestionsHandler(req, ctx);

      expect(res.status).toBe(200);
      const body = res.jsonBody as any;
      expect(body.questions).toHaveLength(3);
      const returnedIds = body.questions.map((q: any) => q.id);
      expect(returnedIds).toEqual(pinnedIds);
    });

    it("returns questions in the same order as questionIds", async () => {
      const pinnedIds = ["q3", "q1", "q2"];
      mockGameStateRead.mockResolvedValue({
        resource: {
          ...BASE_GAME_STATE,
          isStarted: true,
          questionIds: pinnedIds,
        },
      });
      mockQuestionsFetchAll.mockResolvedValue({
        resources: [QUESTION_POOL[0], QUESTION_POOL[1], QUESTION_POOL[2]],
      });

      const req = createMockRequest();
      const ctx = createMockContext();

      const res = await getQuestionsHandler(req, ctx);

      expect(res.status).toBe(200);
      const returnedIds = (res.jsonBody as any).questions.map(
        (q: any) => q.id
      );
      expect(returnedIds).toEqual(["q3", "q1", "q2"]);
    });

    it("returns random questions when quiz is not started", async () => {
      mockGameStateRead.mockResolvedValue({
        resource: {
          ...BASE_GAME_STATE,
          isStarted: false,
          questionIds: [],
        },
      });
      mockQuestionsFetchAll.mockResolvedValue({
        resources: [...QUESTION_POOL],
      });

      const req = createMockRequest({ query: { count: "2" } });
      const ctx = createMockContext();

      const res = await getQuestionsHandler(req, ctx);

      expect(res.status).toBe(200);
      const body = res.jsonBody as any;
      // Falls back to random selection: respects count parameter
      expect(body.questions).toHaveLength(2);
      expect(body.roundId).toBeDefined();
    });
  });

  // === stopQuiz clears pinned questions ===

  describe("stopQuiz clears questions", () => {
    it("clears questionIds from GameState", async () => {
      mockGameStateRead.mockResolvedValue({
        resource: {
          ...BASE_GAME_STATE,
          isStarted: true,
          questionIds: ["q1", "q2", "q3"],
        },
      });

      const req = createMockRequest({
        headers: { "x-user-id": "admin-1" },
      });
      const ctx = createMockContext();

      const res = await stopQuizHandler(req, ctx);

      expect(res.status).toBe(200);
      expect(mockGameStateUpsert).toHaveBeenCalledOnce();
      const upserted = mockGameStateUpsert.mock.calls[0][0] as any;
      expect(upserted.questionIds).toEqual([]);
      expect(upserted.isStarted).toBe(false);
    });
  });

  // === setCategory clears pinned questions ===

  describe("setCategory clears pinned questions", () => {
    it("clears questionIds when category changes", async () => {
      // Existing game state has pinned questions
      mockGameStateRead.mockResolvedValue({
        resource: {
          ...BASE_GAME_STATE,
          isStarted: true,
          questionIds: ["q1", "q2", "q3"],
        },
      });

      // Mock the category lookup
      vi.mocked(categoriesContainer.item).mockReturnValue({
        read: vi.fn().mockResolvedValue({ resource: ACTIVE_CATEGORY }),
      } as any);

      const req = createMockRequest({
        body: { categoryId: "cat-github" },
        headers: { "x-user-id": "admin-1" },
      });
      const ctx = createMockContext();

      const res = await setCategoryHandler(req, ctx);

      expect(res.status).toBe(200);
      expect(mockGameStateUpsert).toHaveBeenCalledOnce();
      const upserted = mockGameStateUpsert.mock.calls[0][0] as any;
      expect(upserted.questionIds).toEqual([]);
      expect(upserted.activeCategoryId).toBe("cat-github");
    });
  });
});
