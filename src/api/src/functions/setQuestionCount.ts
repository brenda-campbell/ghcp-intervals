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

const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;

const signalROutput = output.generic({
  type: "signalR",
  name: "signalRMessages",
  hubName: "gameHub",
  connectionStringSetting: "AzureSignalRConnectionString",
});

async function setQuestionCount(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("setQuestionCount called");

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

  let body: { questionCount?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const { questionCount } = body;
  if (
    questionCount === undefined ||
    typeof questionCount !== "number" ||
    !Number.isInteger(questionCount) ||
    questionCount < MIN_QUESTION_COUNT ||
    questionCount > MAX_QUESTION_COUNT
  ) {
    return {
      status: 400,
      jsonBody: {
        error: `questionCount must be an integer between ${MIN_QUESTION_COUNT} and ${MAX_QUESTION_COUNT}.`,
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

    gameState.questionCount = questionCount;
    gameState.updatedAt = new Date().toISOString();
    gameState.updatedBy = admin.userId;

    const { resource: saved } = await gameStateContainer.items.upsert(gameState);

    context.extraOutputs.set(signalROutput, [
      {
        target: "questionCountChanged",
        arguments: [
          {
            questionCount,
            changedBy: admin.userId,
          },
        ],
      },
    ]);

    return { status: 200, jsonBody: saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`setQuestionCount failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to update question count" } };
  }
}

app.http("setQuestionCount", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "game/question-count",
  extraOutputs: [signalROutput],
  handler: setQuestionCount,
});
