import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { usersContainer } from "../services/cosmosClient";
import { requireAdmin } from "../services/adminAuth";
import { User } from "../models";

async function deleteUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("deleteUser called");

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

  if (targetUserId === admin.userId) {
    return {
      status: 400,
      jsonBody: { error: "Cannot delete your own account" },
    };
  }

  try {
    const { resource: targetUser } = await usersContainer
      .item(targetUserId, targetUserId)
      .read<User>();

    if (!targetUser) {
      return { status: 404, jsonBody: { error: "User not found" } };
    }

    await usersContainer.item(targetUserId, targetUserId).delete();

    context.log(
      `User ${targetUserId} deleted by admin ${admin.userId}`
    );
    return { status: 200, jsonBody: { deleted: true, userId: targetUserId } };
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
    context.error(`deleteUser failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to delete user" } };
  }
}

app.http("deleteUser", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "users/{userId}",
  handler: deleteUser,
});
