import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  output,
} from "@azure/functions";
import {
  gameStateContainer,
  questionsContainer,
  usersContainer,
} from "../services/cosmosClient.js";
import { requireAdmin } from "../services/adminAuth.js";
import type { GameState, Question, User } from "../models/index.js";

const DEFAULT_QUESTION_COUNT = 3;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;
const DEFAULT_TIMER_SECONDS = 10;
const MIN_TIMER_SECONDS = 5;
const MAX_TIMER_SECONDS = 60;

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

    // Resolve question count and timer: body > gameState > default
    let body: { questionCount?: number; timerSeconds?: number } = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        body = parsed as typeof body;
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    let questionCount: number;
    if (body.questionCount !== undefined) {
      if (
        typeof body.questionCount !== "number" ||
        !Number.isInteger(body.questionCount) ||
        body.questionCount < MIN_QUESTION_COUNT ||
        body.questionCount > MAX_QUESTION_COUNT
      ) {
        return {
          status: 400,
          jsonBody: {
            error: `questionCount must be an integer between ${MIN_QUESTION_COUNT} and ${MAX_QUESTION_COUNT}.`,
          },
        };
      }
      questionCount = body.questionCount;
    } else {
      questionCount = gameState.questionCount ?? DEFAULT_QUESTION_COUNT;
    }

    // Resolve timer seconds: body > gameState > default
    let timerSeconds: number;
    if (body.timerSeconds !== undefined) {
      if (
        typeof body.timerSeconds !== "number" ||
        !Number.isInteger(body.timerSeconds) ||
        body.timerSeconds < MIN_TIMER_SECONDS ||
        body.timerSeconds > MAX_TIMER_SECONDS
      ) {
        return {
          status: 400,
          jsonBody: {
            error: `timerSeconds must be an integer between ${MIN_TIMER_SECONDS} and ${MAX_TIMER_SECONDS}.`,
          },
        };
      }
      timerSeconds = body.timerSeconds;
    } else {
      timerSeconds = gameState.timerSeconds ?? DEFAULT_TIMER_SECONDS;
    }

    // Select and pin random questions from the active category
    const { resources: pool } = await questionsContainer.items
      .query<Question>({
        query: "SELECT * FROM c WHERE c.category = @category",
        parameters: [{ name: "@category", value: gameState.activeCategoryId }],
      })
      .fetchAll();

    if (!pool || pool.length === 0) {
      return {
        status: 400,
        jsonBody: { error: "No questions available for the active category." },
      };
    }

    if (pool.length < questionCount) {
      return {
        status: 400,
        jsonBody: {
          error: `Not enough questions. Requested ${questionCount}, but only ${pool.length} available.`,
        },
      };
    }

    // Fisher-Yates shuffle and pick questionCount
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const pinned = shuffled.slice(0, questionCount);

    // Set isStarted to true and store pinned question IDs + count + timer
    gameState.isStarted = true;
    gameState.questionIds = pinned.map((q) => q.id);
    gameState.questionCount = questionCount;
    gameState.timerSeconds = timerSeconds;
    // Auto-stop: total time = questions × (timer + 2s feedback) + 10s buffer
    const FEEDBACK_SECONDS = 2;
    const BUFFER_SECONDS = 10;
    gameState.quizEndsAt = Date.now() + questionCount * (timerSeconds + FEEDBACK_SECONDS) * 1000 + BUFFER_SECONDS * 1000;
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
            timerSeconds,
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
