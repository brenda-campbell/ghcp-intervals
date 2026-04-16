/** Question format discriminator — MC has 4 options, T/F has 2 */
export type QuestionType = "multiple-choice" | "true-false";

/** Stored question document in Cosmos DB (questions container, partition /category) */
export interface Question {
  id: string;
  category: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  difficulty: "easy" | "medium" | "hard";
  type: QuestionType;
}

/** Client-facing question — correctIndex is NEVER exposed (ADR-007) */
export interface QuestionResponse {
  id: string;
  category: string;
  questionText: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
  type: QuestionType;
}

/** User profile document in Cosmos DB (users container, partition /userId) */
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
  correctIndex: number;
  elapsedTimeMs: number;
  timeTaken: number;
  pointsAwarded: number;
  categoryId?: string;
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

/** Category document in Cosmos DB (categories container) */
export interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  questionFormat: QuestionType;
  questionCount?: number; // populated dynamically, not stored
  createdAt: string;
}

/** Per-user per-category score (categoryScores container, partition /categoryId) */
export interface CategoryScore {
  id: string;          // composite: `${userId}_${categoryId}`
  userId: string;
  categoryId: string;
  categoryName: string;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  fastestTimeMs: number;
  updatedAt: string;
}

/** Singleton game state document (gameState container, id = "current") */
export interface GameState {
  id: string;          // always "current"
  activeCategoryId: string;
  activeCategoryName: string;
  activeQuestionFormat: QuestionType;
  isStarted: boolean;
  updatedAt: string;
  updatedBy: string;   // userId of admin who changed it
}

/** A single row on a category-scoped leaderboard */
export interface CategoryLeaderboardEntry {
  userId: string;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  fastestTimeMs: number;
  rank: number;
}
