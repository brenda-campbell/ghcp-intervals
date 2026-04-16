import { usersContainer } from "./cosmosClient.js";
import type { User, LeaderboardEntry } from "../models/index.js";

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
