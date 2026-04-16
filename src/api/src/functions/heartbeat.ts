import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  registerPlayer,
  cleanStalePresence,
  getOnlineCount,
} from "../services/presenceService.js";

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

  return { status: 200, jsonBody: { count } };
}

app.http("heartbeat", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game/heartbeat",
  handler: heartbeat,
});
