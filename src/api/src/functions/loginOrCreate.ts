import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { randomUUID, timingSafeEqual } from "crypto";
import { gameStateContainer, usersContainer } from "../services/cosmosClient";
import { GameState, User } from "../models";
import {
  getCorrelationId,
  logRequest,
  logSuccess,
  logError,
  correlationHeaders,
} from "../services/logger.js";
import { withRetry, isCircuitOpen, recordSuccess, recordFailure } from "../services/resilience.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CIRCUIT_NAME = "cosmos-loginOrCreate";
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE ?? "CopilotDevDays2026";

function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to keep constant time, then return false
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

async function loginOrCreate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const start = Date.now();
  const correlationId = getCorrelationId(request.headers);
  const headers = correlationHeaders(correlationId);

  logRequest(context, "loginOrCreate", correlationId, { method: request.method });

  // Circuit breaker — fast-fail if Cosmos is known-down
  if (isCircuitOpen(CIRCUIT_NAME)) {
    logError(context, "loginOrCreate", correlationId, new Error("Circuit open"), Date.now() - start);
    return {
      status: 503,
      headers,
      jsonBody: { error: "Service temporarily unavailable. Please try again shortly." },
    };
  }

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
    return { status: 400, headers, jsonBody: { error: "Invalid JSON body" } };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { status: 400, headers, jsonBody: { error: "Invalid email format" } };
  }

  // Mask email for logging (show domain only)
  const emailDomain = email.split("@")[1] ?? "unknown";

  try {
    // Look up existing user by email (with retry)
    const { resources } = await withRetry(
      () =>
        usersContainer.items
          .query<User>({
            query: "SELECT * FROM c WHERE c.email = @email",
            parameters: [{ name: "@email", value: email }],
          })
          .fetchAll(),
      context,
      "loginOrCreate-lookup"
    );

    if (resources.length > 0) {
      const existing = resources[0];

      if (existing.isActive === false) {
        logSuccess(context, "loginOrCreate", correlationId, Date.now() - start, "inactive account");
        return { status: 403, headers, jsonBody: { error: "Account is inactive" } };
      }

      // Admin passcode gate
      if (existing.isAdmin) {
        const passcode = request.headers.get("x-admin-passcode");
        if (!passcode) {
          return {
            status: 401,
            headers,
            jsonBody: { error: "Admin passcode required", code: "ADMIN_PASSCODE_REQUIRED" },
          };
        }
        if (!constantTimeCompare(passcode, ADMIN_PASSCODE)) {
          return {
            status: 401,
            headers,
            jsonBody: { error: "Invalid admin passcode", code: "ADMIN_PASSCODE_INVALID" },
          };
        }
      }

      recordSuccess(CIRCUIT_NAME);
      logSuccess(context, "loginOrCreate", correlationId, Date.now() - start, "existing user login");
      return { status: 200, headers, jsonBody: existing };
    }

    // New user — check if registration is open
    let registrationOpen = true;
    try {
      const { resource: gameState } = await withRetry(
        () => gameStateContainer.item("current", "current").read<GameState>(),
        context,
        "loginOrCreate-gameState"
      );
      if (gameState && gameState.isRegistrationOpen === false) {
        registrationOpen = false;
      }
    } catch {
      // No game state or 404 — default to open
    }

    if (!registrationOpen) {
      logSuccess(context, "loginOrCreate", correlationId, Date.now() - start, "registration closed");
      return {
        status: 403,
        headers,
        jsonBody: { error: "Registration is currently closed", code: "REGISTRATION_CLOSED" },
      };
    }

    // New user — validate displayName
    if (displayName.length < 2 || displayName.length > 30) {
      return {
        status: 400,
        headers,
        jsonBody: { error: "displayName must be 2-30 characters" },
      };
    }

    // No user with this email — check for legacy user linking
    const legacyUserId = request.headers.get("x-legacy-user-id");

    if (legacyUserId) {
      try {
        const { resource: legacyUser } = await withRetry(
          () => usersContainer.item(legacyUserId, legacyUserId).read<User>(),
          context,
          "loginOrCreate-legacyLookup"
        );

        if (legacyUser) {
          const now = new Date().toISOString();
          const updated: User = {
            ...legacyUser,
            email,
            displayName,
            updatedAt: now,
          };

          await withRetry(
            () => usersContainer.item(legacyUserId, legacyUserId).replace(updated),
            context,
            "loginOrCreate-legacyLink"
          );

          recordSuccess(CIRCUIT_NAME);
          logSuccess(context, "loginOrCreate", correlationId, Date.now() - start, `linked legacy user to @${emailDomain}`);
          return { status: 200, headers, jsonBody: updated };
        }
      } catch {
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

    await withRetry(
      () => usersContainer.items.create(newUser),
      context,
      "loginOrCreate-create"
    );

    recordSuccess(CIRCUIT_NAME);
    logSuccess(context, "loginOrCreate", correlationId, Date.now() - start, `new user @${emailDomain}`);
    return { status: 201, headers, jsonBody: newUser };
  } catch (err: unknown) {
    recordFailure(CIRCUIT_NAME, context);
    logError(context, "loginOrCreate", correlationId, err, Date.now() - start);
    return { status: 500, headers, jsonBody: { error: "Failed to login or create user" } };
  }
}

app.http("loginOrCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "users/login-or-create",
  handler: loginOrCreate,
});
