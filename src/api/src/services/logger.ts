import { InvocationContext } from "@azure/functions";
import { randomUUID } from "crypto";

/**
 * Structured logging utility for Azure Functions endpoints.
 * Uses context.log/context.error — no external dependencies.
 */

export interface LogContext {
  correlationId: string;
  functionName: string;
}

/** Extract or generate a correlation ID from the request headers. */
export function getCorrelationId(headers: Headers): string {
  return headers.get("x-correlation-id") || randomUUID();
}

/** Log an incoming request with key params (never sensitive data). */
export function logRequest(
  context: InvocationContext,
  functionName: string,
  correlationId: string,
  params: Record<string, unknown> = {}
): void {
  context.log(
    JSON.stringify({
      event: "request_received",
      functionName,
      correlationId,
      ...params,
      timestamp: new Date().toISOString(),
    })
  );
}

/** Log a successful completion with duration and optional summary. */
export function logSuccess(
  context: InvocationContext,
  functionName: string,
  correlationId: string,
  durationMs: number,
  summary?: string
): void {
  context.log(
    JSON.stringify({
      event: "request_success",
      functionName,
      correlationId,
      durationMs,
      summary,
      timestamp: new Date().toISOString(),
    })
  );
}

/** Log an error with structured details. */
export function logError(
  context: InvocationContext,
  functionName: string,
  correlationId: string,
  error: unknown,
  durationMs?: number
): void {
  const errorType =
    error instanceof Error ? error.constructor.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack?.split("\n").slice(0, 3).join(" | ") : undefined;

  context.error(
    JSON.stringify({
      event: "request_error",
      functionName,
      correlationId,
      errorType,
      message,
      stack,
      durationMs,
      timestamp: new Date().toISOString(),
    })
  );
}

/** Add correlation ID to response headers. */
export function correlationHeaders(correlationId: string): Record<string, string> {
  return { "x-correlation-id": correlationId };
}
