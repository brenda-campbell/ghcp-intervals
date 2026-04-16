import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { usersContainer } from "../services/cosmosClient";
import { requireAdmin } from "../services/adminAuth";
import { User } from "../models";

async function toggleUserStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("toggleUserStatus called");

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

  const targetUserId = request.params.userId;
  if (!targetUserId) {
    return { status: 400, jsonBody: { error: "Missing userId parameter" } };
  }

  let isActive: boolean;
  try {
    const body = (await request.json()) as { isActive?: boolean };
    if (typeof body?.isActive !== "boolean") {
      return {
        status: 400,
        jsonBody: { error: "Request body must include isActive (boolean)" },
      };
    }
    isActive = body.isActive;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  // Prevent admin from deactivating themselves
  if (targetUserId === admin.userId && !isActive) {
    return {
      status: 400,
      jsonBody: { error: "Cannot deactivate your own account" },
    };
  }

  try {
    const { resource: targetUser } = await usersContainer
      .item(targetUserId, targetUserId)
      .read<User>();

    if (!targetUser) {
      return { status: 404, jsonBody: { error: "User not found" } };
    }

    const now = new Date().toISOString();
    const updated: User = {
      ...targetUser,
      isActive,
      updatedAt: now,
    };

    await usersContainer
      .item(targetUserId, targetUserId)
      .replace(updated);

    context.log(
      `User ${targetUserId} isActive set to ${isActive} by admin ${admin.userId}`
    );
    return { status: 200, jsonBody: updated };
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
    context.error(`toggleUserStatus failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to update user status" } };
  }
}

app.http("toggleUserStatus", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "users/{userId}/status",
  handler: toggleUserStatus,
});
