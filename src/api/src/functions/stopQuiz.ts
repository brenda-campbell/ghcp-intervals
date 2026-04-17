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
import { _resetFastestTracker } from "../services/fastestAnswerTracker.js";
import type { GameState, User } from "../models/index.js";

const signalROutput = output.generic({
  type: "signalR",
  name: "signalRMessages",
  hubName: "gameHub",
  connectionStringSetting: "AzureSignalRConnectionString",
});

async function stopQuiz(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("stopQuiz called");

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

    // Set isStarted to false and clear pinned questions
    gameState.isStarted = false;
    gameState.questionIds = [];
    gameState.updatedAt = new Date().toISOString();
    gameState.updatedBy = admin.userId;

    // Clear fastest-answer tracker so next round starts fresh
    _resetFastestTracker();

    const { resource: saved } = await gameStateContainer.items.upsert(gameState);

    // Broadcast quizStopped event via SignalR
    context.extraOutputs.set(signalROutput, [
      {
        target: "quizStopped",
        arguments: [
          {
            stoppedAt: new Date().toISOString(),
            stoppedBy: admin.userId,
          },
        ],
      },
    ]);

    return { status: 200, jsonBody: saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`stopQuiz failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to stop quiz" } };
  }
}

app.http("stopQuiz", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game/stop-quiz",
  extraOutputs: [signalROutput],
  handler: stopQuiz,
});
