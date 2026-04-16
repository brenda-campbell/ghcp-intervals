import { HttpRequest } from "@azure/functions";
import { Container } from "@azure/cosmos";
import { User } from "../models";

/**
 * Check whether a user document has isAdmin === true.
 * Returns false for missing users or users without the flag.
 */
export async function isAdminUser(
  userId: string,
  container: Container
): Promise<boolean> {
  try {
    const { resource } = await container.item(userId, userId).read<User>();
    return resource?.isAdmin === true;
  } catch {
    return false;
  }
}

/**
 * Extract x-user-id header, verify the user is an admin, and return the
 * admin User document. Throws an object with `status` and `message` if
 * authorization fails so callers can return an appropriate HTTP response.
 *
 * Per ADR-010: userId comes from x-user-id header (lightweight game auth).
 */
export async function requireAdmin(
  request: HttpRequest,
  container: Container
): Promise<User> {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    throw { status: 401, message: "Missing x-user-id header" };
  }

  try {
    const { resource } = await container.item(userId, userId).read<User>();

    if (!resource) {
      throw { status: 403, message: "User not found" };
    }

    if (resource.isAdmin !== true) {
      throw { status: 403, message: "Admin access required" };
    }

    return resource;
  } catch (err: unknown) {
    // Re-throw our own structured errors
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      "message" in err
    ) {
      throw err;
    }
    throw { status: 403, message: "Authorization check failed" };
  }
}
