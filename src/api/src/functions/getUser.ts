import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { usersContainer } from "../services/cosmosClient";
import { User } from "../models";

async function getUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = request.params.userId;
  context.log(`getUser called for userId=${userId}`);

  if (!userId) {
    return { status: 400, jsonBody: { error: "Missing userId parameter" } };
  }

  try {
    const { resource } = await usersContainer
      .item(userId, userId)
      .read<User>();

    if (!resource) {
      return { status: 404, jsonBody: { error: "User not found" } };
    }

    return { status: 200, jsonBody: resource };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 404
    ) {
      return { status: 404, jsonBody: { error: "User not found" } };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`getUser failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to fetch user" } };
  }
}

app.http("getUser", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "user/{userId}",
  handler: getUser,
});
