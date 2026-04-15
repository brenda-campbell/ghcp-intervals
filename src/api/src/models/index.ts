/** Stored question document in Cosmos DB (questions container, partition /category) */
export interface Question {
  id: string;
  category: string;
  questionText: string;
  options: [string, string, string, string];
  correctIndex: number;
  difficulty: "easy" | "medium" | "hard";
}

/** Client-facing question — correctIndex is NEVER exposed (ADR-007) */
export interface QuestionResponse {
  id: string;
  category: string;
  questionText: string;
  options: [string, string, string, string];
}

/** User profile document in Cosmos DB (users container, partition /userId) */
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

/** Client submission payload when answering a question */
export interface AnswerSubmission {
  questionId: string;
  selectedOption: number;
  userId: string;
  clientTimestamp: number;
}

/** Server response after evaluating an answer */
export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  elapsedTimeMs: number;
  pointsAwarded: number;
}

/** A game round grouping questions together */
export interface GameRound {
  id: string;
  roundId: string;
  questionIds: string[];
  createdAt: string;
}

/** A single row on the leaderboard */
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalScore: number;
  rank: number;
  fastestTimeMs: number;
}
