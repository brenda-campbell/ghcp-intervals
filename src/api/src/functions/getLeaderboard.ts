import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { usersContainer } from "../services/cosmosClient.js";
import { getTopLeaderboard, toLeaderboardEntry, getCategoryLeaderboard } from "../services/leaderboardService.js";
import type { User, LeaderboardEntry } from "../models/index.js";
import {
  getCorrelationId,
  logRequest,
  logSuccess,
  logError,
  correlationHeaders,
} from "../services/logger.js";

async function getLeaderboard(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const start = Date.now();
  const correlationId = getCorrelationId(request.headers);
  const headers = correlationHeaders(correlationId);

  logRequest(context, "getLeaderboard", correlationId);

  const categoryId = request.query.get("categoryId") || undefined;

  if (categoryId) {
    // Category-specific leaderboard
    try {
      const leaderboard = await getCategoryLeaderboard(categoryId);
      logSuccess(context, "getLeaderboard", correlationId, Date.now() - start, `category=${categoryId}`);
      return { status: 200, headers, jsonBody: { leaderboard, categoryId } };
    } catch (err) {
      logError(context, "getLeaderboard", correlationId, err, Date.now() - start);
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 500, headers, jsonBody: { error: "Failed to fetch category leaderboard", detail: msg } };
    }
  }

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
                  "SELECT VALUE COUNT(1) FROM c WHERE c.isActive != false AND (c.totalScore > @score OR (c.totalScore = @score AND c.fastestTimeMs < @time))",
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

    logSuccess(context, "getLeaderboard", correlationId, Date.now() - start, `entries=${leaderboard.length}`);
    return {
      status: 200,
      headers,
      jsonBody: { leaderboard, userRank },
    };
  } catch (err) {
    logError(context, "getLeaderboard", correlationId, err, Date.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 500, headers, jsonBody: { error: "Failed to fetch leaderboard", detail: msg } };
  }
}

app.http("getLeaderboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "leaderboard",
  handler: getLeaderboard,
});
