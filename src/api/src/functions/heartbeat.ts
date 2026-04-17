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
  let body: { userId?: string; displayName?: string };
  try {
    body = (await request.json()) as { userId?: string; displayName?: string };
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const { userId, displayName } = body;

  if (!userId || typeof userId !== "string") {
    return { status: 400, jsonBody: { error: "Missing or invalid userId" } };
  }
  if (!displayName || typeof displayName !== "string") {
    return { status: 400, jsonBody: { error: "Missing or invalid displayName" } };
  }

  registerPlayer(userId, displayName);
  cleanStalePresence();

  const count = getOnlineCount();
  context.log(`Heartbeat: user=${userId} online=${count}`);

  // Broadcast presence update so all clients get real-time count
  context.extraOutputs.set(signalROutput, [
    {
      target: "presenceUpdate",
      arguments: [{ count, userId, displayName }],
    },
  ]);

  return { status: 200, jsonBody: { count } };
}

app.http("heartbeat", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game/heartbeat",
  extraOutputs: [signalROutput],
  handler: heartbeat,
});
