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

async function setRegistration(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("setRegistration called");

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

  let body: { isOpen?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const { isOpen } = body;
  if (typeof isOpen !== "boolean") {
    return {
      status: 400,
      jsonBody: { error: "isOpen must be a boolean." },
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

    gameState.isRegistrationOpen = isOpen;
    gameState.updatedAt = new Date().toISOString();
    gameState.updatedBy = admin.userId;

    const { resource: saved } = await gameStateContainer.items.upsert(gameState);

    context.extraOutputs.set(signalROutput, [
      {
        target: "registrationChanged",
        arguments: [{ isOpen }],
      },
    ]);

    return { status: 200, jsonBody: saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`setRegistration failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to update registration setting" } };
  }
}

app.http("setRegistration", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "game/registration",
  extraOutputs: [signalROutput],
  handler: setRegistration,
});
