import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  output,
} from "@azure/functions";
import {
  registerPlayer,
  cleanStalePresence,
  getOnlineCount,
} from "../services/presenceService.js";
import {
  getCorrelationId,
  logRequest,
  logSuccess,
  correlationHeaders,
} from "../services/logger.js";

const signalROutput = output.generic({
  type: "signalR",
  name: "signalRMessages",
  hubName: "gameHub",
  connectionStringSetting: "AzureSignalRConnectionString",
});

async function heartbeat(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const start = Date.now();
  const correlationId = getCorrelationId(request.headers);
  const headers = correlationHeaders(correlationId);

  let body: { userId?: string; displayName?: string };
  try {
    body = (await request.json()) as { userId?: string; displayName?: string };
  } catch {
    return { status: 400, headers, jsonBody: { error: "Invalid JSON body" } };
  }

  const { userId, displayName } = body;

  if (!userId || typeof userId !== "string") {
    return { status: 400, headers, jsonBody: { error: "Missing or invalid userId" } };
  }
  if (!displayName || typeof displayName !== "string") {
    return { status: 400, headers, jsonBody: { error: "Missing or invalid displayName" } };
  }

  logRequest(context, "heartbeat", correlationId, { userId });

  registerPlayer(userId, displayName);
  cleanStalePresence();

  const count = getOnlineCount();

  // Broadcast presence update so all clients get real-time count
  context.extraOutputs.set(signalROutput, [
    {
      target: "presenceUpdate",
      arguments: [{ count, userId, displayName }],
    },
  ]);

  logSuccess(context, "heartbeat", correlationId, Date.now() - start, `online=${count}`);
  return { status: 200, headers, jsonBody: { count } };
}

app.http("heartbeat", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game/heartbeat",
  extraOutputs: [signalROutput],
  handler: heartbeat,
});
