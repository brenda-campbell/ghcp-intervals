import { usersContainer } from "./cosmosClient.js";
import type { PatchOperation } from "@azure/cosmos";

/**
 * Atomically update a user's score in Cosmos DB using patch operations.
 * - Increments totalScore by pointsAwarded
 * - Updates fastestTimeMs if this answer was faster (or if never set)
 * - Sets updatedAt to now
 *
 * NOTE: gamesPlayed is NOT incremented here — it was being incremented on
 * every answer submission, overcounting by the number of questions per round.
 * Use incrementGamesPlayed() once per completed round instead.
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
    currentFastest === null || currentFastest === undefined || currentFastest === 0 || elapsedTimeMs < currentFastest
      ? elapsedTimeMs
      : currentFastest;

  const operations: PatchOperation[] = [
    { op: "incr", path: "/totalScore", value: pointsAwarded },
    { op: "replace", path: "/fastestTimeMs", value: newFastest },
    { op: "replace", path: "/updatedAt", value: now },
  ];

  await item.patch(operations);
}

/**
 * Increment gamesPlayed by 1 for a user. Called once per completed round,
 * NOT per answer submission.
 */
export async function incrementGamesPlayed(userId: string): Promise<void> {
  const item = usersContainer.item(userId, userId);
  const now = new Date().toISOString();
  const operations: PatchOperation[] = [
    { op: "incr", path: "/gamesPlayed", value: 1 },
    { op: "replace", path: "/updatedAt", value: now },
  ];
  await item.patch(operations);
}
