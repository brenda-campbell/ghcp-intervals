// Tracks the fastest correct answer time per question (in-memory, per-instance).
// Used for relative speed-based scoring: fastest correct answer gets 200 points,
// others get proportionally less based on their response time ratio.
const fastestCorrectMs = new Map<string, number>();

export function recordCorrectAnswer(questionId: string, elapsedTimeMs: number): void {
  const current = fastestCorrectMs.get(questionId);
  if (current === undefined || elapsedTimeMs < current) {
    fastestCorrectMs.set(questionId, elapsedTimeMs);
  }
}

export function getFastestCorrectMs(questionId: string): number | undefined {
  return fastestCorrectMs.get(questionId);
}

export function clearFastestForQuestion(questionId: string): void {
  fastestCorrectMs.delete(questionId);
}

export function _resetFastestTracker(): void {
  fastestCorrectMs.clear();
}
