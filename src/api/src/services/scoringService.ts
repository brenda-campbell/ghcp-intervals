import { usersContainer } from "./cosmosClient.js";
import type { PatchOperation } from "@azure/cosmos";

/**
 * Atomically update a user's score in Cosmos DB using patch operations.
 * - Increments totalScore by pointsAwarded
 * - Increments gamesPlayed by 1
 * - Updates fastestTimeMs if this answer was faster (or if never set)
 * - Sets updatedAt to now
 */
export async function updateUserScore(
  userId: string,
  pointsAwarded: number,
  elapsedTimeMs: number
): Promise<void> {
  const item = usersContainer.item(userId, userId);

  // Read current user to decide fastestTimeMs update
  const { resource: user } = await item.read();
  if (!user) {
    throw new Error(`User ${userId} not found — cannot update score`);
  }

  const now = new Date().toISOString();
  const currentFastest = user.fastestTimeMs as number | null;
  const newFastest =
    currentFastest === null || currentFastest === undefined || elapsedTimeMs < currentFastest
      ? elapsedTimeMs
      : currentFastest;

  const operations: PatchOperation[] = [
    { op: "incr", path: "/totalScore", value: pointsAwarded },
    { op: "incr", path: "/gamesPlayed", value: 1 },
    { op: "replace", path: "/fastestTimeMs", value: newFastest },
    { op: "replace", path: "/updatedAt", value: now },
  ];

  await item.patch(operations);
}
