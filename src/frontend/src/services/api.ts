export interface Question {
  id: string;
  questionText: string;
  options: string[];
  category: string;
  difficulty: string;
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

export async function getLeaderboard(userId?: string): Promise<LeaderboardResponse> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const response = await fetch(`/api/leaderboard${params}`);
  return handleResponse<LeaderboardResponse>(response);
}
