import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { gameStateContainer } from "../services/cosmosClient.js";
import type { GameState } from "../models/index.js";
import {
  getCorrelationId,
  logRequest,
  logSuccess,
  logError,
  correlationHeaders,
} from "../services/logger.js";
import { withResilience } from "../services/resilience.js";

const DEFAULT_GAME_STATE = {
  activeCategoryId: null,
  activeCategoryName: null,
  isStarted: false,
  timerSeconds: 10,
  isRegistrationOpen: true,
};

async function getGameState(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const start = Date.now();
  const correlationId = getCorrelationId(request.headers);
  const headers = correlationHeaders(correlationId);

  logRequest(context, "getGameState", correlationId);

  try {
    const { result: resource, fromFallback } = await withResilience(
      "cosmos-getGameState",
      async () => {
        const { resource: res } = await gameStateContainer
          .item("current", "current")
          .read<GameState>();
        return res ?? null;
      },
      null, // fallback: null means use defaults
      context
    );

    if (fromFallback || !resource) {
      const summary = fromFallback ? "circuit-open fallback" : "no game state";
      logSuccess(context, "getGameState", correlationId, Date.now() - start, summary);
      return { status: 200, headers, jsonBody: DEFAULT_GAME_STATE };
    }

    const body = {
      ...resource,
      timerSeconds: resource.timerSeconds ?? 10,
      isRegistrationOpen: resource.isRegistrationOpen ?? true,
    };

    logSuccess(context, "getGameState", correlationId, Date.now() - start, "ok");
    return { status: 200, headers, jsonBody: body };
  } catch (err: unknown) {
    // 404 from Cosmos means no game state set yet
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 404
    ) {
      logSuccess(context, "getGameState", correlationId, Date.now() - start, "not-found default");
      return { status: 200, headers, jsonBody: DEFAULT_GAME_STATE };
    }

    logError(context, "getGameState", correlationId, err, Date.now() - start);
    return { status: 500, headers, jsonBody: { error: "Failed to get game state" } };
  }
}

app.http("getGameState", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game/state",
  handler: getGameState,
});
