import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  output,
} from "@azure/functions";
import {
  categoriesContainer,
  gameStateContainer,
  usersContainer,
} from "../services/cosmosClient.js";
import { requireAdmin } from "../services/adminAuth.js";
import type { Category, GameState, User } from "../models/index.js";

const signalROutput = output.generic({
  type: "signalR",
  name: "signalRMessages",
  hubName: "gameHub",
  connectionStringSetting: "AzureSignalRConnectionString",
});

async function setCategory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("setCategory called");

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

  let body: { categoryId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const { categoryId } = body;
  if (!categoryId || typeof categoryId !== "string") {
    return { status: 400, jsonBody: { error: "categoryId is required" } };
  }

  // Verify category exists and is active
  let category: Category | undefined;
  try {
    const { resource } = await categoriesContainer
      .item(categoryId, categoryId)
      .read<Category>();
    category = resource;
  } catch {
    return { status: 400, jsonBody: { error: "Category not found" } };
  }

  if (!category) {
    return { status: 400, jsonBody: { error: "Category not found" } };
  }

  if (!category.isActive) {
    return { status: 400, jsonBody: { error: "Category is inactive" } };
  }

  // Read current game state to preserve isStarted
  let currentIsStarted = false;
  try {
    const { resource: existing } = await gameStateContainer
      .item("current", "current")
      .read<GameState>();
    if (existing) {
      currentIsStarted = existing.isStarted ?? false;
    }
  } catch {
    // No existing state — default isStarted to false
  }

  // Upsert game state
  const gameState: GameState = {
    id: "current",
    activeCategoryId: category.id,
    activeCategoryName: category.name,
    activeQuestionFormat: category.questionFormat,
    isStarted: currentIsStarted,
    updatedAt: new Date().toISOString(),
    updatedBy: admin.userId,
  };

  try {
    const { resource: saved } = await gameStateContainer.items.upsert(gameState);

    // Broadcast category change via SignalR
    context.extraOutputs.set(signalROutput, [
      {
        target: "categoryChanged",
        arguments: [
          {
            categoryId: category.id,
            categoryName: category.name,
            questionFormat: category.questionFormat,
          },
        ],
      },
    ]);

    return { status: 200, jsonBody: saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`setCategory failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to set active category" } };
  }
}

app.http("setCategory", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game/set-category",
  extraOutputs: [signalROutput],
  handler: setCategory,
});
