import { usersContainer, categoryScoresContainer } from "./cosmosClient.js";
import type { User, LeaderboardEntry, CategoryScore, CategoryLeaderboardEntry } from "../models/index.js";

export function toLeaderboardEntry(user: User, rank: number): LeaderboardEntry {
  return {
    userId: user.userId,
    displayName: user.displayName,
    totalScore: user.totalScore,
    rank,
    fastestTimeMs: user.fastestTimeMs,
  };
}

/**
 * Fetch the top-10 leaderboard from Cosmos DB.
 * Ties broken by fastest cumulative time (ASC).
 */
export async function getTopLeaderboard(): Promise<LeaderboardEntry[]> {
  const { resources: topUsers } = await usersContainer.items
    .query<User>({
      query:
        "SELECT * FROM c WHERE c.isActive != false ORDER BY c.totalScore DESC, c.fastestTimeMs ASC OFFSET 0 LIMIT 10",
    })
    .fetchAll();

  return topUsers.map((u, i) => toLeaderboardEntry(u, i + 1));
}

export function toCategoryLeaderboardEntry(score: CategoryScore, rank: number): CategoryLeaderboardEntry {
  return {
    userId: score.userId,
    displayName: score.displayName,
    totalScore: score.totalScore,
    gamesPlayed: score.gamesPlayed,
    fastestTimeMs: score.fastestTimeMs,
    rank,
  };
}

/**
 * Fetch the top-10 leaderboard for a specific category.
 * Ties broken by fastest time (ASC).
 */
export async function getCategoryLeaderboard(categoryId: string): Promise<CategoryLeaderboardEntry[]> {
  const { resources: topScores } = await categoryScoresContainer.items
    .query<CategoryScore>({
      query: "SELECT * FROM c WHERE c.categoryId = @categoryId ORDER BY c.totalScore DESC, c.fastestTimeMs ASC OFFSET 0 LIMIT 10",
      parameters: [{ name: "@categoryId", value: categoryId }],
    })
    .fetchAll();

  return topScores.map((s, i) => toCategoryLeaderboardEntry(s, i + 1));
}
