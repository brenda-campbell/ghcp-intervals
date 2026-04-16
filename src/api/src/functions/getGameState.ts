import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { gameStateContainer } from "../services/cosmosClient.js";
import type { GameState } from "../models/index.js";

async function getGameState(
  _request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("getGameState called");

  try {
    const { resource } = await gameStateContainer
      .item("current", "current")
      .read<GameState>();

    if (resource) {
      return { status: 200, jsonBody: resource };
    }

    return {
      status: 200,
      jsonBody: { activeCategoryId: null, activeCategoryName: null },
    };
  } catch (err: unknown) {
    // 404 from Cosmos means no game state set yet
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 404
    ) {
      return {
        status: 200,
        jsonBody: { activeCategoryId: null, activeCategoryName: null },
      };
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`getGameState failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to get game state" } };
  }
}

app.http("getGameState", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game/state",
  handler: getGameState,
});
