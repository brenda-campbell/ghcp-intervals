import { logApiCall, logError } from "@/services/logger";

// --- Category Types ---

export type QuestionType = "multiple-choice" | "true-false";

export interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  questionFormat: QuestionType;
  questionCount?: number;
  createdAt: string;
}

export interface GameState {
  activeCategoryId: string | null;
  activeCategoryName: string | null;
  activeQuestionFormat: QuestionType;
  isStarted: boolean;
  isRegistrationOpen?: boolean;
  questionIds?: string[];
  questionCount?: number;
  timerSeconds?: number;
  updatedAt?: string;
}

export interface OnlinePlayersResponse {
  count: number;
  players?: { userId: string; displayName: string; lastSeen: string }[];
}

export interface Question {
  id: string;
  questionText: string;
  options: string[];
  category: string;
  difficulty: string;
  type?: QuestionType;
}

export interface QuestionsResponse {
  questions: Question[];
}

export interface AnswerSubmission {
  questionId: string;
  userId: string;
  selectedOption: number;
  clientTimestamp: number;
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  correctIndex: number;
  elapsedTimeMs: number;
  timeTaken: number;
  pointsAwarded: number;
}

export interface User {
  id: string;
  userId: string;
  displayName: string;
  email?: string;
  isActive?: boolean;   // default true when missing (ADR-012)
  isAdmin?: boolean;    // default false when missing (ADR-012)
  totalScore: number;
  gamesPlayed: number;
  fastestTimeMs: number;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(
    status: number,
    message: string,
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export { ApiError as ApiRequestError };

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Parse JSON body to get the actual error message from the API
    let message = `Server error (${response.status})`;
    let code: string | undefined;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
      if (body?.code) code = body.code;
    } catch {
      // Body wasn't JSON — use status code fallback
      if (response.statusText) message = `API error: ${response.statusText}`;
    }
    const correlationId = response.headers.get("x-correlation-id");
    const err = new ApiError(response.status, message, code);
    logError("api.handleResponse", err, {
      endpoint: response.url,
      statusCode: String(response.status),
      ...(correlationId ? { correlationId } : {}),
    });
    throw err;
  }
  return response.json() as Promise<T>;
}

/** Retry a fetch-based call up to `retries` times on 5xx / network errors */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const start = performance.now();
    try {
      const result = await fn();
      logApiCall("withRetry", performance.now() - start, true);
      return result;
    } catch (err) {
      lastErr = err;
      logApiCall(
        "withRetry",
        performance.now() - start,
        false,
        err instanceof ApiError ? err.status : undefined,
      );
      const isRetryable =
        (err instanceof ApiError && err.status >= 500) ||
        (err instanceof TypeError); // network error
      if (!isRetryable || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Instrumented fetch — logs timing and status for every API call */
async function instrumentedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const endpoint = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const start = performance.now();
  try {
    const response = await fetch(input, init);
    logApiCall(endpoint, performance.now() - start, response.ok, response.status);
    return response;
  } catch (err) {
    logApiCall(endpoint, performance.now() - start, false);
    throw err;
  }
}

export async function fetchQuestions(count: number): Promise<Question[]> {
  const response = await instrumentedFetch(`/api/questions?count=${count}`);
  const data = await handleResponse<QuestionsResponse>(response);
  return data.questions;
}

export async function submitAnswer(
  submission: AnswerSubmission,
): Promise<AnswerResult> {
  const response = await instrumentedFetch("/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  return handleResponse<AnswerResult>(response);
}

export async function loginOrCreate(
  email: string,
  displayName: string,
  legacyUserId?: string,
  adminPasscode?: string,
): Promise<User> {
  return withRetry(async () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (legacyUserId) headers["x-legacy-user-id"] = legacyUserId;
    if (adminPasscode) headers["x-admin-passcode"] = adminPasscode;
    const response = await instrumentedFetch("/api/users/login-or-create", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, displayName }),
    });
    return handleResponse<User>(response);
  });
}

export async function getUser(userId: string): Promise<User> {
  const response = await instrumentedFetch(`/api/users/${encodeURIComponent(userId)}`);
  return handleResponse<User>(response);
}

export async function listUsers(
  adminUserId: string,
): Promise<{ users: User[] }> {
  const response = await instrumentedFetch("/api/users", {
    headers: { "x-user-id": adminUserId },
  });
  return handleResponse<{ users: User[] }>(response);
}

export async function toggleUserStatus(
  targetUserId: string,
  isActive: boolean,
  adminUserId: string,
): Promise<User> {
  const response = await instrumentedFetch(
    `/api/users/${encodeURIComponent(targetUserId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
      body: JSON.stringify({ isActive }),
    },
  );
  return handleResponse<User>(response);
}

export async function deleteUser(
  targetUserId: string,
  adminUserId: string,
): Promise<{ deleted: boolean; userId: string }> {
  const response = await instrumentedFetch(
    `/api/users/${encodeURIComponent(targetUserId)}`,
    {
      method: "DELETE",
      headers: { "x-user-id": adminUserId },
    },
  );
  return handleResponse<{ deleted: boolean; userId: string }>(response);
}

// --- Leaderboard ---

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  fastestTimeMs: number;
  rank: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  userRank?: {
    entry: LeaderboardEntry;
    rank: number;
  };
}

export async function getLeaderboard(userId?: string, categoryId?: string): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (categoryId) params.set("categoryId", categoryId);
  const qs = params.toString();
  const response = await instrumentedFetch(`/api/leaderboard${qs ? `?${qs}` : ""}`);
  return handleResponse<LeaderboardResponse>(response);
}

// --- Categories ---

export async function listCategories(adminUserId?: string): Promise<Category[]> {
  const headers: Record<string, string> = {};
  if (adminUserId) headers["x-user-id"] = adminUserId;
  const response = await instrumentedFetch("/api/categories", { headers });
  const data = await handleResponse<{ categories: Category[] }>(response);
  return data.categories;
}

export async function createCategory(
  name: string,
  description: string,
  questionFormat: QuestionType,
  adminUserId: string,
): Promise<Category> {
  const response = await instrumentedFetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ name, description, questionFormat }),
  });
  return handleResponse<Category>(response);
}

export async function updateCategory(
  categoryId: string,
  updates: Partial<Pick<Category, "name" | "description" | "questionFormat" | "isActive">>,
  adminUserId: string,
): Promise<Category> {
  const response = await instrumentedFetch(`/api/categories/${encodeURIComponent(categoryId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify(updates),
  });
  return handleResponse<Category>(response);
}

export async function deleteCategory(
  categoryId: string,
  adminUserId: string,
): Promise<void> {
  const response = await instrumentedFetch(`/api/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
    headers: { "x-user-id": adminUserId },
  });
  if (!response.ok) throw new ApiError(response.status, `API error: ${response.statusText}`);
}

// --- Game State ---

export async function getGameState(): Promise<GameState> {
  return withRetry(async () => {
    const response = await instrumentedFetch("/api/game/state");
    return handleResponse<GameState>(response);
  });
}

export async function startQuiz(adminUserId: string, questionCount?: number): Promise<GameState> {
  const response = await instrumentedFetch("/api/game/start-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify(questionCount ? { questionCount } : {}),
  });
  return handleResponse<GameState>(response);
}

export async function stopQuiz(adminUserId: string): Promise<GameState> {
  const response = await instrumentedFetch("/api/game/stop-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
  });
  return handleResponse<GameState>(response);
}

export async function setQuestionCount(count: number, adminUserId: string): Promise<GameState> {
  const response = await instrumentedFetch("/api/game/question-count", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ questionCount: count }),
  });
  return handleResponse<GameState>(response);
}

export async function setTimer(seconds: number, adminUserId: string): Promise<GameState> {
  const response = await instrumentedFetch("/api/game/timer", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ timerSeconds: seconds }),
  });
  return handleResponse<GameState>(response);
}

export async function setRegistration(isOpen: boolean, adminUserId: string): Promise<GameState> {
  const response = await instrumentedFetch("/api/game/registration", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ isOpen }),
  });
  return handleResponse<GameState>(response);
}

export async function setActiveCategory(
  categoryId: string,
  adminUserId: string,
): Promise<GameState> {
  const response = await instrumentedFetch("/api/game/set-category", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ categoryId }),
  });
  return handleResponse<GameState>(response);
}

// --- Online Presence ---

export async function getOnlinePlayers(adminUserId?: string): Promise<OnlinePlayersResponse> {
  const headers: Record<string, string> = {};
  if (adminUserId) headers["x-user-id"] = adminUserId;
  const response = await instrumentedFetch("/api/game/online-players", { headers });
  return handleResponse<OnlinePlayersResponse>(response);
}

// --- Score Reset ---

export async function resetScores(
  adminUserId: string,
  scope: "all" | "selected",
  userIds?: string[],
  categoryId?: string,
): Promise<{ reset: boolean; usersAffected: number }> {
  const response = await instrumentedFetch("/api/scores/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ scope, userIds, categoryId }),
  });
  return handleResponse<{ reset: boolean; usersAffected: number }>(response);
}

export async function markRoundComplete(userId: string): Promise<{ success: boolean }> {
  const response = await instrumentedFetch("/api/game/round-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return handleResponse<{ success: boolean }>(response);
}

export async function sendHeartbeat(userId: string, displayName: string): Promise<{ count: number }> {
  const response = await instrumentedFetch("/api/game/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, displayName }),
  });
  return handleResponse<{ count: number }>(response);
}
