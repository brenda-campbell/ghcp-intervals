import { InvocationContext } from "@azure/functions";

/**
 * Lightweight resilience primitives for Cosmos DB operations.
 * - Exponential backoff retry (retryable status codes only)
 * - Simple circuit breaker (trip after N consecutive failures)
 */

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

const RETRYABLE_CODES = new Set([429, 503]);
const CLIENT_ERROR_CODES = new Set([400, 401, 403, 404, 409]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 200;

function isRetryable(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const code = (err as { code?: number }).code;
    if (typeof code === "number") {
      if (CLIENT_ERROR_CODES.has(code)) return false;
      if (RETRYABLE_CODES.has(code)) return true;
    }
    // Cosmos SDK sometimes uses statusCode
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (typeof statusCode === "number") {
      if (CLIENT_ERROR_CODES.has(statusCode)) return false;
      if (RETRYABLE_CODES.has(statusCode)) return true;
    }
    // Transient network errors
    const name = (err as { name?: string }).name;
    if (name === "TimeoutError" || name === "AbortError") return true;
    const msg = (err as { message?: string }).message ?? "";
    if (/ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(msg)) return true;
  }
  return false;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  context?: InvocationContext,
  label?: string
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS && isRetryable(err)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        context?.warn(
          `[retry] ${label ?? "operation"} attempt ${attempt} failed, retrying in ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw lastError; // unreachable but satisfies TS
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuits = new Map<string, CircuitState>();

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30_000; // 30 seconds

function getCircuit(name: string): CircuitState {
  let state = circuits.get(name);
  if (!state) {
    state = { failures: 0, lastFailureTime: 0, isOpen: false };
    circuits.set(name, state);
  }
  return state;
}

/** Check if the circuit is currently open. If cooldown has elapsed, move to half-open. */
export function isCircuitOpen(name: string): boolean {
  const state = getCircuit(name);
  if (!state.isOpen) return false;
  // Check if cooldown has elapsed → half-open (allow one attempt)
  if (Date.now() - state.lastFailureTime > COOLDOWN_MS) {
    return false; // allow attempt
  }
  return true;
}

/** Record a success — reset the circuit. */
export function recordSuccess(name: string): void {
  const state = getCircuit(name);
  state.failures = 0;
  state.isOpen = false;
}

/** Record a failure — increment counter, trip if threshold exceeded. */
export function recordFailure(name: string, context?: InvocationContext): void {
  const state = getCircuit(name);
  state.failures++;
  state.lastFailureTime = Date.now();
  if (state.failures >= FAILURE_THRESHOLD) {
    state.isOpen = true;
    context?.error(
      `[circuit-breaker] Circuit "${name}" OPEN after ${state.failures} consecutive failures. Cooldown: ${COOLDOWN_MS}ms`
    );
  }
}

/**
 * Execute an operation with retry + circuit breaker.
 * Returns the fallback value when the circuit is open.
 */
export async function withResilience<T>(
  name: string,
  operation: () => Promise<T>,
  fallback: T,
  context?: InvocationContext,
): Promise<{ result: T; fromFallback: boolean }> {
  if (isCircuitOpen(name)) {
    context?.warn(`[circuit-breaker] Circuit "${name}" is OPEN — returning fallback`);
    return { result: fallback, fromFallback: true };
  }

  try {
    const result = await withRetry(operation, context, name);
    recordSuccess(name);
    return { result, fromFallback: false };
  } catch (err) {
    recordFailure(name, context);
    throw err;
  }
}

/** Reset all circuits (for testing). */
export function _resetCircuits(): void {
  circuits.clear();
}
