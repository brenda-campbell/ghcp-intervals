import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { randomUUID } from "crypto";
import { usersContainer } from "../services/cosmosClient";
import { User } from "../models";

function generateDisplayName(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Player-${digits}`;
}

async function createUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("createUser called");

  try {
    let displayName: string | undefined;
    try {
      const body = (await request.json()) as { displayName?: string };
      displayName = body?.displayName;
    } catch {
      // No body or invalid JSON — that's fine, we'll generate a name
    }

    const userId = randomUUID();
    const now = new Date().toISOString();

    const user: User = {
      id: userId,
      userId,
      displayName: displayName?.trim() || generateDisplayName(),
      totalScore: 0,
      gamesPlayed: 0,
      fastestTimeMs: null as unknown as number,
      createdAt: now,
      updatedAt: now,
    };

    await usersContainer.items.create(user);
    context.log(`Created user ${user.userId} (${user.displayName})`);

    return { status: 201, jsonBody: user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`createUser failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to create user" } };
  }
}

app.http("createUser", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "user",
  handler: createUser,
});
