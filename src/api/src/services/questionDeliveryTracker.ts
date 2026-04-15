/**
 * Tracks when questions were delivered to clients (server-side timestamps).
 *
 * APPROACH (be-answer-api):
 * In-memory Map keyed by "{questionId}:{userId}" → server delivery timestamp.
 * The getQuestions endpoint should call `recordDelivery()` when serving questions.
 * submitAnswer calls `getDeliveryTimestamp()` to compute elapsed time per ADR-003.
 *
 * LIMITATION: In-memory state is lost on cold starts and is per-instance in
 * scaled-out scenarios. For production multi-instance deployments, migrate this
 * to Cosmos DB (e.g., a `deliveries` container) or Azure Cache for Redis.
 */

const deliveryTimestamps = new Map<string, number>();

function makeKey(questionId: string, userId: string): string {
  return `${questionId}:${userId}`;
}

/** Record when a question was delivered to a specific user. */
export function recordDelivery(
  questionId: string,
  userId: string,
  serverTimestamp: number = Date.now()
): void {
  deliveryTimestamps.set(makeKey(questionId, userId), serverTimestamp);
}

/** Get the server-side delivery timestamp for a question+user pair. */
export function getDeliveryTimestamp(
  questionId: string,
  userId: string
): number | undefined {
  return deliveryTimestamps.get(makeKey(questionId, userId));
}

/** Remove a delivery record after it's been consumed. */
export function clearDelivery(questionId: string, userId: string): void {
  deliveryTimestamps.delete(makeKey(questionId, userId));
}
