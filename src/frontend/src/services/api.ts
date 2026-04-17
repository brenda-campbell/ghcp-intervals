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
  constructor(
    status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export { ApiError as ApiRequestError };

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, `API error: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchQuestions(count: number): Promise<Question[]> {
  const response = await fetch(`/api/questions?count=${count}`);
  const data = await handleResponse<QuestionsResponse>(response);
  return data.questions;
}

export async function submitAnswer(
  submission: AnswerSubmission,
): Promise<AnswerResult> {
  const response = await fetch("/api/answer", {
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
): Promise<User> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (legacyUserId) headers["x-legacy-user-id"] = legacyUserId;
  const response = await fetch("/api/users/login-or-create", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, displayName }),
  });
  return handleResponse<User>(response);
}

export async function getUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}`);
  return handleResponse<User>(response);
}

export async function listUsers(
  adminUserId: string,
): Promise<{ users: User[] }> {
  const response = await fetch("/api/users", {
    headers: { "x-user-id": adminUserId },
  });
  return handleResponse<{ users: User[] }>(response);
}

export async function toggleUserStatus(
  targetUserId: string,
  isActive: boolean,
  adminUserId: string,
): Promise<User> {
  const response = await fetch(
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
  const response = await fetch(
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
  const response = await fetch(`/api/leaderboard${qs ? `?${qs}` : ""}`);
  return handleResponse<LeaderboardResponse>(response);
}

// --- Categories ---

export async function listCategories(adminUserId?: string): Promise<Category[]> {
  const headers: Record<string, string> = {};
  if (adminUserId) headers["x-user-id"] = adminUserId;
  const response = await fetch("/api/categories", { headers });
  const data = await handleResponse<{ categories: Category[] }>(response);
  return data.categories;
}

export async function createCategory(
  name: string,
  description: string,
  questionFormat: QuestionType,
  adminUserId: string,
): Promise<Category> {
  const response = await fetch("/api/categories", {
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
  const response = await fetch(`/api/categories/${encodeURIComponent(categoryId)}`, {
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
  const response = await fetch(`/api/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
    headers: { "x-user-id": adminUserId },
  });
  if (!response.ok) throw new ApiError(response.status, `API error: ${response.statusText}`);
}

// --- Game State ---

export async function getGameState(): Promise<GameState> {
  const response = await fetch("/api/game/state");
  return handleResponse<GameState>(response);
}

export async function startQuiz(adminUserId: string, questionCount?: number): Promise<GameState> {
  const response = await fetch("/api/game/start-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify(questionCount ? { questionCount } : {}),
  });
  return handleResponse<GameState>(response);
}

export async function stopQuiz(adminUserId: string): Promise<GameState> {
  const response = await fetch("/api/game/stop-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
  });
  return handleResponse<GameState>(response);
}

export async function setQuestionCount(count: number, adminUserId: string): Promise<GameState> {
  const response = await fetch("/api/game/question-count", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ questionCount: count }),
  });
  return handleResponse<GameState>(response);
}

export async function setTimer(seconds: number, adminUserId: string): Promise<GameState> {
  const response = await fetch("/api/game/timer", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ timerSeconds: seconds }),
  });
  return handleResponse<GameState>(response);
}

export async function setRegistration(isOpen: boolean, adminUserId: string): Promise<GameState> {
  const response = await fetch("/api/game/registration", {
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
  const response = await fetch("/api/game/set-category", {
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
  const response = await fetch("/api/game/online-players", { headers });
  return handleResponse<OnlinePlayersResponse>(response);
}

// --- Score Reset ---

export async function resetScores(
  adminUserId: string,
  scope: "all" | "selected",
  userIds?: string[],
  categoryId?: string,
): Promise<{ reset: boolean; usersAffected: number }> {
  const response = await fetch("/api/scores/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": adminUserId },
    body: JSON.stringify({ scope, userIds, categoryId }),
  });
  return handleResponse<{ reset: boolean; usersAffected: number }>(response);
}

export async function markRoundComplete(userId: string): Promise<{ success: boolean }> {
  const response = await fetch("/api/game/round-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return handleResponse<{ success: boolean }>(response);
}

export async function sendHeartbeat(userId: string, displayName: string): Promise<{ count: number }> {
  const response = await fetch("/api/game/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, displayName }),
  });
  return handleResponse<{ count: number }>(response);
}
