import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { gameStateContainer } from "../services/cosmosClient.js";
import {
  getCorrelationId,
  logRequest,
  logSuccess,
  logError,
  correlationHeaders,
} from "../services/logger.js";

async function healthCheck(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const start = Date.now();
  const correlationId = getCorrelationId(request.headers);
  logRequest(context, "healthCheck", correlationId);

  const result: Record<string, unknown> = {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };

  // Cosmos DB connectivity check
  const cosmosStart = Date.now();
  try {
    await gameStateContainer.item("current", "current").read();
    result.cosmosDb = "connected";
    result.cosmosResponseMs = Date.now() - cosmosStart;
  } catch (err: unknown) {
    // 404 is fine — means Cosmos is reachable but doc doesn't exist yet
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 404
    ) {
      result.cosmosDb = "connected";
      result.cosmosResponseMs = Date.now() - cosmosStart;
    } else {
      result.status = "unhealthy";
      result.cosmosDb = "disconnected";
      result.cosmosResponseMs = Date.now() - cosmosStart;
      result.cosmosError =
        err instanceof Error ? err.message : "Unknown error";

      logError(context, "healthCheck", correlationId, err, Date.now() - start);
      return {
        status: 503,
        jsonBody: result,
        headers: correlationHeaders(correlationId),
      };
    }
  }

  const durationMs = Date.now() - start;
  logSuccess(context, "healthCheck", correlationId, durationMs, "all systems operational");

  return {
    status: 200,
    jsonBody: result,
    headers: correlationHeaders(correlationId),
  };
}

app.http("healthCheck", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthCheck,
});
