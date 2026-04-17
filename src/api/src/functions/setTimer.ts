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

const MIN_TIMER_SECONDS = 5;
const MAX_TIMER_SECONDS = 60;

const signalROutput = output.generic({
  type: "signalR",
  name: "signalRMessages",
  hubName: "gameHub",
  connectionStringSetting: "AzureSignalRConnectionString",
});

async function setTimer(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("setTimer called");

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

  let body: { timerSeconds?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const { timerSeconds } = body;
  if (
    timerSeconds === undefined ||
    typeof timerSeconds !== "number" ||
    !Number.isInteger(timerSeconds) ||
    timerSeconds < MIN_TIMER_SECONDS ||
    timerSeconds > MAX_TIMER_SECONDS
  ) {
    return {
      status: 400,
      jsonBody: {
        error: `timerSeconds must be an integer between ${MIN_TIMER_SECONDS} and ${MAX_TIMER_SECONDS}.`,
      },
    };
  }

  try {
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

    gameState.timerSeconds = timerSeconds;
    gameState.updatedAt = new Date().toISOString();
    gameState.updatedBy = admin.userId;

    const { resource: saved } = await gameStateContainer.items.upsert(gameState);

    context.extraOutputs.set(signalROutput, [
      {
        target: "timerChanged",
        arguments: [
          {
            timerSeconds,
            changedBy: admin.userId,
          },
        ],
      },
    ]);

    return { status: 200, jsonBody: saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`setTimer failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to update timer" } };
  }
}

app.http("setTimer", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "game/timer",
  extraOutputs: [signalROutput],
  handler: setTimer,
});
