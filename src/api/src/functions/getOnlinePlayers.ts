import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { usersContainer } from "../services/cosmosClient.js";
import type { User } from "../models/index.js";
import {
  cleanStalePresence,
  getOnlineCount,
  getOnlinePlayersList,
} from "../services/presenceService.js";

async function getOnlinePlayers(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("getOnlinePlayers called");

  cleanStalePresence();

  const userId = request.headers.get("x-user-id");
  const count = getOnlineCount();

  // Check if admin
  let isAdmin = false;
  if (userId) {
    try {
      const { resource } = await usersContainer.item(userId, userId).read<User>();
      isAdmin = resource?.isAdmin === true;
    } catch { /* not admin */ }
  }

  if (isAdmin) {
    // Admin gets full list
    const players = getOnlinePlayersList();
    return { status: 200, jsonBody: { count, players } };
  } else {
    // Regular users get count only
    return { status: 200, jsonBody: { count } };
  }
}

app.http("getOnlinePlayers", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game/online-players",
  handler: getOnlinePlayers,
});
