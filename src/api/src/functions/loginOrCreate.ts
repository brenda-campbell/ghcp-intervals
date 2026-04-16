import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { randomUUID } from "crypto";
import { usersContainer } from "../services/cosmosClient";
import { User } from "../models";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loginOrCreate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("loginOrCreate called");

  let email: string;
  let displayName: string;

  try {
    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
    };
    email = (body?.email ?? "").trim();
    displayName = (body?.displayName ?? "").trim();
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { status: 400, jsonBody: { error: "Invalid email format" } };
  }

  try {
    // Look up existing user by email
    const { resources } = await usersContainer.items
      .query<User>({
        query: "SELECT * FROM c WHERE c.email = @email",
        parameters: [{ name: "@email", value: email }],
      })
      .fetchAll();

    if (resources.length > 0) {
      const existing = resources[0];

      if (existing.isActive === false) {
        return { status: 403, jsonBody: { error: "Account is inactive" } };
      }

      return { status: 200, jsonBody: existing };
    }

    // New user — validate displayName
    if (displayName.length < 2 || displayName.length > 30) {
      return {
        status: 400,
        jsonBody: { error: "displayName must be 2-30 characters" },
      };
    }

    // No user with this email — check for legacy user linking
    const legacyUserId = request.headers.get("x-legacy-user-id");

    if (legacyUserId) {
      try {
        const { resource: legacyUser } = await usersContainer
          .item(legacyUserId, legacyUserId)
          .read<User>();

        if (legacyUser) {
          const now = new Date().toISOString();
          const updated: User = {
            ...legacyUser,
            email,
            displayName,
            updatedAt: now,
          };

          await usersContainer
            .item(legacyUserId, legacyUserId)
            .replace(updated);

          context.log(
            `Linked legacy user ${legacyUserId} to email ${email}`
          );
          return { status: 200, jsonBody: updated };
        }
      } catch {
        // Legacy user not found — fall through to create new
        context.log(
          `Legacy user ${legacyUserId} not found, creating new user`
        );
      }
    }

    // Create brand-new user
    const userId = randomUUID();
    const now = new Date().toISOString();

    const newUser: User = {
      id: userId,
      userId,
      email,
      displayName,
      isActive: true,
      isAdmin: false,
      totalScore: 0,
      gamesPlayed: 0,
      fastestTimeMs: 0,
      createdAt: now,
      updatedAt: now,
    };

    await usersContainer.items.create(newUser);
    context.log(`Created user ${userId} (${displayName})`);

    return { status: 201, jsonBody: newUser };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`loginOrCreate failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to login or create user" } };
  }
}

app.http("loginOrCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "users/login-or-create",
  handler: loginOrCreate,
});
