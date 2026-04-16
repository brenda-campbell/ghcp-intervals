import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { usersContainer } from "../services/cosmosClient";
import { requireAdmin } from "../services/adminAuth";
import { User } from "../models";

async function listUsers(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("listUsers called");

  try {
    await requireAdmin(request, usersContainer);
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
    const { resources: users } = await usersContainer.items
      .query<User>("SELECT * FROM c ORDER BY c.createdAt DESC")
      .fetchAll();

    return { status: 200, jsonBody: { users } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`listUsers failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to list users" } };
  }
}

app.http("listUsers", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "users",
  handler: listUsers,
});
