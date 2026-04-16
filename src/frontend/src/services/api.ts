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

export async function createUser(displayName?: string): Promise<User> {
  const response = await fetch("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayName ? { displayName } : {}),
  });
  return handleResponse<User>(response);
}

export async function getUser(userId: string): Promise<User> {
  const response = await fetch(`/api/user/${encodeURIComponent(userId)}`);
  return handleResponse<User>(response);
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
