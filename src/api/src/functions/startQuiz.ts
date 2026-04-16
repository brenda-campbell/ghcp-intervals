import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  output,
} from "@azure/functions";
import {
  gameStateContainer,
  usersContainer,
} from "../services/cosmosClient.js";
import { requireAdmin } from "../services/adminAuth.js";
import type { GameState, User } from "../models/index.js";

const signalROutput = output.generic({
  type: "signalR",
  name: "signalRMessages",
  hubName: "gameHub",
  connectionStringSetting: "AzureSignalRConnectionString",
});

async function startQuiz(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("startQuiz called");

  let admin: User;
  try {
    admin = await requireAdmin(request, usersContainer);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      "message" in err
    ) {
      const typed = err as { status: number; message: string };
      return { status: typed.status, jsonBody: { error: typed.message } };
    }
    return { status: 403, jsonBody: { error: "Authorization failed" } };
  }

  try {
    // Read current game state
    let gameState: GameState | undefined;
    try {
      const { resource } = await gameStateContainer
        .item("current", "current")
        .read<GameState>();
      gameState = resource;
    } catch {
      // No existing state
    }

    if (!gameState) {
      return {
        status: 400,
        jsonBody: { error: "No game state exists. Set a category first." },
      };
    }

    // Set isStarted to true
    gameState.isStarted = true;
    gameState.updatedAt = new Date().toISOString();
    gameState.updatedBy = admin.userId;

    const { resource: saved } = await gameStateContainer.items.upsert(gameState);

    // Broadcast quizStarted event via SignalR
    context.extraOutputs.set(signalROutput, [
      {
        target: "quizStarted",
        arguments: [
          {
            startedAt: new Date().toISOString(),
            startedBy: admin.userId,
          },
        ],
      },
    ]);

    return { status: 200, jsonBody: saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`startQuiz failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to start quiz" } };
  }
}

app.http("startQuiz", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game/start-quiz",
  extraOutputs: [signalROutput],
  handler: startQuiz,
});
