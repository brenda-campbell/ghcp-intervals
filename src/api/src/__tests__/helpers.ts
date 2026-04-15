import type { HttpRequest, InvocationContext } from "@azure/functions";
import { vi } from "vitest";

export function createMockRequest(options: {
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  bodyError?: boolean;
} = {}): HttpRequest {
  const queryParams = new URLSearchParams(options.query || {});
  return {
    query: {
      get: (key: string) => queryParams.get(key),
      has: (key: string) => queryParams.has(key),
    },
    params: options.params || {},
    json: options.bodyError
      ? vi.fn().mockRejectedValue(new Error("Invalid JSON"))
      : vi.fn().mockResolvedValue(options.body),
  } as unknown as HttpRequest;
}

export function createMockContext(): InvocationContext {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    extraInputs: {
      get: vi.fn(),
    },
    extraOutputs: {
      set: vi.fn(),
    },
  } as unknown as InvocationContext;
}
