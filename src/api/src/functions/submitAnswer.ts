import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  output,
} from "@azure/functions";
import { questionsContainer } from "../services/cosmosClient.js";
import {
  getDeliveryTimestamp,
  clearDelivery,
} from "../services/questionDeliveryTracker.js";
import { updateUserScore } from "../services/scoringService.js";
import { getTopLeaderboard } from "../services/leaderboardService.js";
import type { AnswerSubmission, AnswerResult, Question, LeaderboardEntry } from "../models/index.js";

// Module-level question cache (questions don't change during gameplay)
const questionCache = new Map<string, Question>();

// Throttle leaderboard broadcasts — at most once per second
let lastLeaderboardBroadcast = 0;
let cachedLeaderboard: LeaderboardEntry[] | null = null;
const LEADERBOARD_THROTTLE_MS = 1000;

/** Reset module-level caches (for testing) */
export function _resetSubmitAnswerCaches(): void {
  questionCache.clear();
  lastLeaderboardBroadcast = 0;
  cachedLeaderboard = null;
}

interface SignalRMessage {
  target: string;
  arguments: unknown[];
}

const signalROutput = output.generic({
  type: "signalR",
  name: "signalRMessages",
  hubName: "gameHub",
  connectionStringSetting: "AzureSignalRConnectionString",
});

const QUESTION_TIMEOUT_MS = 10_000; // 10-second round window
const BASE_POINTS = 100;
const MAX_SPEED_BONUS = 100;

function calculatePoints(correct: boolean, elapsedTimeMs: number): number {
  if (!correct) return 0;
  const clampedElapsed = Math.min(Math.max(elapsedTimeMs, 0), QUESTION_TIMEOUT_MS);
  const speedBonus = Math.round(
    MAX_SPEED_BONUS * (1 - clampedElapsed / QUESTION_TIMEOUT_MS)
  );
  return BASE_POINTS + speedBonus;
}

async function submitAnswer(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // ADR-003: Record server receipt timestamp immediately — this is authoritative
  const serverReceiptTimestamp = Date.now();

  // Parse request body
  let body: AnswerSubmission;
  try {
    body = (await request.json()) as AnswerSubmission;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const { questionId, selectedOption, userId, clientTimestamp } = body;

  // Validate required fields
  if (!questionId || typeof questionId !== "string") {
    return { status: 400, jsonBody: { error: "Missing or invalid questionId" } };
  }
  if (!userId || typeof userId !== "string") {
    return { status: 400, jsonBody: { error: "Missing or invalid userId" } };
  }
  if (typeof selectedOption !== "number" || !Number.isInteger(selectedOption)) {
    return { status: 400, jsonBody: { error: "Missing or invalid selectedOption" } };
  }
  if (selectedOption < 0 || selectedOption > 3) {
    return {
      status: 400,
      jsonBody: { error: "selectedOption must be 0, 1, 2, or 3" },
    };
  }

  // Look up question — check in-memory cache first to avoid cross-partition query
  let question = questionCache.get(questionId);
  if (!question) {
    try {
      const { resources } = await questionsContainer.items
        .query<Question>({
          query: "SELECT * FROM c WHERE c.id = @id",
          parameters: [{ name: "@id", value: questionId }],
        })
        .fetchAll();

      if (resources.length === 0) {
        return { status: 404, jsonBody: { error: "Question not found" } };
      }
      question = resources[0];
      questionCache.set(questionId, question);
    } catch (err) {
      context.error("Cosmos DB query failed:", err);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  }

  // ADR-007: Validate correctness server-side
  const correct = selectedOption === question.correctIndex;
  const correctAnswer = question.options[question.correctIndex];

  // Calculate elapsed time using server-side delivery tracker (ADR-003).
  // Falls back to clientTimestamp if no delivery record exists (e.g., cold start).
  const deliveredAt = getDeliveryTimestamp(questionId, userId);
  let elapsedTimeMs: number;
  if (deliveredAt !== undefined) {
    elapsedTimeMs = serverReceiptTimestamp - deliveredAt;
    clearDelivery(questionId, userId);
  } else {
    context.warn(
      `No delivery record for question ${questionId} / user ${userId}. ` +
        "Falling back to clientTimestamp — timing may be less accurate."
    );
    elapsedTimeMs = clientTimestamp
      ? serverReceiptTimestamp - clientTimestamp
      : 0;
  }
  elapsedTimeMs = Math.max(elapsedTimeMs, 0);

  const pointsAwarded = calculatePoints(correct, elapsedTimeMs);

  context.log(
    `Answer: user=${userId} q=${questionId} option=${selectedOption} ` +
      `correct=${correct} elapsed=${elapsedTimeMs}ms points=${pointsAwarded}`
  );

  // Persist score to user document in Cosmos DB
  try {
    await updateUserScore(userId, pointsAwarded, elapsedTimeMs);
  } catch (err) {
    context.error(`Failed to update score for user ${userId}:`, err);
    // Don't fail the answer response — scoring is best-effort
    // The user still gets their result; score update can be retried
  }

  // Broadcast real-time updates via SignalR (best-effort)
  const signalRMessages: SignalRMessage[] = [];

  // "playerAnswered" — let everyone see that someone answered (no answer details)
  signalRMessages.push({
    target: "playerAnswered",
    arguments: [{ usersAnswered: 1 }],
  });

  // "leaderboardUpdate" — throttled to avoid 80 queries per round
  const now = Date.now();
  if (now - lastLeaderboardBroadcast > LEADERBOARD_THROTTLE_MS || !cachedLeaderboard) {
    try {
      cachedLeaderboard = await getTopLeaderboard();
      lastLeaderboardBroadcast = now;
    } catch (err) {
      context.warn("Failed to fetch leaderboard for SignalR broadcast:", err);
    }
  }
  if (cachedLeaderboard) {
    signalRMessages.push({
      target: "leaderboardUpdate",
      arguments: [{ leaderboard: cachedLeaderboard }],
    });
  }

  context.extraOutputs.set(signalROutput, signalRMessages);

  const result: AnswerResult = {
    correct,
    correctAnswer,
    correctIndex: question.correctIndex,
    elapsedTimeMs,
    timeTaken: elapsedTimeMs,
    pointsAwarded,
  };

  return { status: 200, jsonBody: result };
}

app.http("submitAnswer", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "answer",
  extraOutputs: [signalROutput],
  handler: submitAnswer,
});
