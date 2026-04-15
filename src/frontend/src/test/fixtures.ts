import { vi } from "vitest"
import type { User, Question, AnswerResult, LeaderboardResponse } from "@/services/api"

export const mockUser: User = {
  id: "doc-1",
  userId: "user-abc-123",
  displayName: "TestPlayer",
  totalScore: 1500,
  gamesPlayed: 10,
  fastestTimeMs: 2340,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-15T00:00:00Z",
}

export const mockQuestions: Question[] = [
  {
    id: "q1",
    questionText: "What is Azure Functions?",
    options: [
      "A serverless compute service",
      "A database service",
      "A CDN service",
      "A DNS service",
    ],
    category: "Azure",
    difficulty: "easy",
  },
  {
    id: "q2",
    questionText: "What does CI/CD stand for?",
    options: [
      "Computer Integration / Computer Delivery",
      "Continuous Integration / Continuous Delivery",
      "Code Integration / Code Deployment",
      "Central Intelligence / Central Delivery",
    ],
    category: "DevOps",
    difficulty: "medium",
  },
  {
    id: "q3",
    questionText: "Which protocol does SignalR use for real-time communication?",
    options: ["FTP", "SMTP", "WebSocket", "IMAP"],
    category: "Azure",
    difficulty: "hard",
  },
]

export const mockCorrectResult: AnswerResult = {
  correct: true,
  correctIndex: 0,
  pointsAwarded: 100,
  timeTaken: 2500,
}

export const mockIncorrectResult: AnswerResult = {
  correct: false,
  correctIndex: 0,
  pointsAwarded: 0,
  timeTaken: 5000,
}

export const mockLeaderboardEntries = [
  { userId: "u1", displayName: "Alice", totalScore: 5000, gamesPlayed: 20, fastestTimeMs: 1500, rank: 1 },
  { userId: "u2", displayName: "Bob", totalScore: 4200, gamesPlayed: 18, fastestTimeMs: 1800, rank: 2 },
  { userId: "u3", displayName: "Charlie", totalScore: 3800, gamesPlayed: 15, fastestTimeMs: 2100, rank: 3 },
  { userId: "u4", displayName: "Diana", totalScore: 3500, gamesPlayed: 14, fastestTimeMs: 2300, rank: 4 },
  { userId: "u5", displayName: "Eve", totalScore: 3000, gamesPlayed: 12, fastestTimeMs: 2500, rank: 5 },
  { userId: "u6", displayName: "Frank", totalScore: 2800, gamesPlayed: 11, fastestTimeMs: 2700, rank: 6 },
  { userId: "u7", displayName: "Grace", totalScore: 2500, gamesPlayed: 10, fastestTimeMs: 2900, rank: 7 },
  { userId: "u8", displayName: "Hank", totalScore: 2200, gamesPlayed: 9, fastestTimeMs: 3100, rank: 8 },
  { userId: "u9", displayName: "Ivy", totalScore: 2000, gamesPlayed: 8, fastestTimeMs: 3300, rank: 9 },
  { userId: "u10", displayName: "Jack", totalScore: 1800, gamesPlayed: 7, fastestTimeMs: 3500, rank: 10 },
]

export const mockLeaderboardResponse: LeaderboardResponse = {
  leaderboard: mockLeaderboardEntries,
}

export function createMockApis() {
  return {
    fetchQuestions: vi.fn(),
    submitAnswer: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    getLeaderboard: vi.fn(),
  }
}
