import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { randomUUID } from "crypto";
import { questionsContainer } from "../services/cosmosClient.js";
import { Question, QuestionResponse } from "../models/index.js";

const MAX_QUESTIONS = 3;
const DEFAULT_COUNT = 1;

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function toQuestionResponse(q: Question): QuestionResponse {
  return {
    id: q.id,
    category: q.category,
    questionText: q.questionText,
    options: q.options,
  };
}

async function getQuestions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("getQuestions called");

  // Parse and validate count
  const countParam = request.query.get("count");
  let count = DEFAULT_COUNT;

  if (countParam !== null) {
    count = parseInt(countParam, 10);
    if (isNaN(count) || count < 1 || count > MAX_QUESTIONS) {
      return {
        status: 400,
        jsonBody: {
          error: `Invalid count. Must be between 1 and ${MAX_QUESTIONS}.`,
        },
      };
    }
  }

  try {
    const { resources: questions } = await questionsContainer.items
      .query<Question>("SELECT * FROM c")
      .fetchAll();

    if (!questions || questions.length === 0) {
      return {
        status: 404,
        jsonBody: { error: "No questions available." },
      };
    }

    if (questions.length < count) {
      return {
        status: 404,
        jsonBody: {
          error: `Not enough questions available. Requested ${count}, but only ${questions.length} exist.`,
        },
      };
    }

    const selected = shuffleArray(questions).slice(0, count);
    const roundId = randomUUID();

    return {
      status: 200,
      jsonBody: {
        roundId,
        questions: selected.map(toQuestionResponse),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    context.error("Failed to fetch questions from Cosmos DB", msg);
    return {
      status: 500,
      jsonBody: { error: "Internal server error.", detail: msg },
    };
  }
}

app.http("getQuestions", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "questions",
  handler: getQuestions,
});
