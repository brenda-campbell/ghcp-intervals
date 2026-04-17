import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { categoryScoresContainer, gameStateContainer } from "../services/cosmosClient.js";
import { incrementGamesPlayed } from "../services/scoringService.js";
import type { GameState, CategoryScore } from "../models/index.js";

/**
 * POST /api/game/round-complete
 *
 * Called once by the frontend when a player finishes all questions in a round.
 * Increments gamesPlayed on both the user doc and their active category score.
 */
async function roundComplete(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let body: { userId: string };
  try {
    body = (await request.json()) as { userId: string };
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const { userId } = body;
  if (!userId || typeof userId !== "string") {
    return { status: 400, jsonBody: { error: "Missing or invalid userId" } };
  }

  // Increment gamesPlayed on the user document
  try {
    await incrementGamesPlayed(userId);
  } catch (err) {
    context.error(`Failed to increment gamesPlayed for user ${userId}:`, err);
    return { status: 500, jsonBody: { error: "Failed to update user score" } };
  }

  // Also increment gamesPlayed on the active category score (best-effort)
  try {
    const { resource: gameState } = await gameStateContainer
      .item("current", "current")
      .read<GameState>();

    if (gameState?.activeCategoryId) {
      const scoreId = `${userId}_${gameState.activeCategoryId}`;
      try {
        const { resource: catScore } = await categoryScoresContainer
          .item(scoreId, gameState.activeCategoryId)
          .read<CategoryScore>();

        if (catScore) {
          catScore.gamesPlayed += 1;
          catScore.updatedAt = new Date().toISOString();
          await categoryScoresContainer
            .item(scoreId, gameState.activeCategoryId)
            .replace(catScore);
        }
      } catch {
        // Category score doc may not exist yet — that's fine
        context.warn(`No category score found for ${scoreId} — skipping gamesPlayed increment`);
      }
    }
  } catch (err) {
    context.warn("Failed to update category gamesPlayed:", err);
    // Non-fatal — user doc was already updated
  }

  return { status: 200, jsonBody: { success: true } };
}

app.http("roundComplete", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game/round-complete",
  handler: roundComplete,
});
