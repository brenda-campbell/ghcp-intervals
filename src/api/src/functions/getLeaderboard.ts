import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { usersContainer } from "../services/cosmosClient.js";
import { getTopLeaderboard, toLeaderboardEntry } from "../services/leaderboardService.js";
import type { User, LeaderboardEntry } from "../models/index.js";

async function getLeaderboard(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("getLeaderboard called");

  const userId = request.query.get("userId") || undefined;

  try {
    const leaderboard = await getTopLeaderboard();

    let userRank: { entry: LeaderboardEntry; rank: number } | undefined;

    if (userId) {
      const inTop10 = leaderboard.find((e) => e.userId === userId);
      if (inTop10) {
        userRank = { entry: inTop10, rank: inTop10.rank };
      } else {
        // User not in top 10 — fetch their doc and compute rank
        try {
          const { resource: userDoc } = await usersContainer
            .item(userId, userId)
            .read<User>();

          if (userDoc) {
            // Count how many users have a higher score (or same score but faster time)
            const { resources: countResult } = await usersContainer.items
              .query<number>({
                query:
                  "SELECT VALUE COUNT(1) FROM c WHERE c.totalScore > @score OR (c.totalScore = @score AND c.fastestTimeMs < @time)",
                parameters: [
                  { name: "@score", value: userDoc.totalScore },
                  { name: "@time", value: userDoc.fastestTimeMs ?? Number.MAX_SAFE_INTEGER },
                ],
              })
              .fetchAll();

            const rank = (countResult[0] ?? 0) + 1;
            userRank = {
              entry: toLeaderboardEntry(userDoc, rank),
              rank,
            };
          }
        } catch (err) {
          context.warn(`Could not fetch rank for userId=${userId}:`, err);
          // Non-fatal — return leaderboard without user rank
        }
      }
    }

    return {
      status: 200,
      jsonBody: { leaderboard, userRank },
    };
  } catch (err) {
    context.error("getLeaderboard failed:", err);
    return { status: 500, jsonBody: { error: "Failed to fetch leaderboard" } };
  }
}

app.http("getLeaderboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "leaderboard",
  handler: getLeaderboard,
});
