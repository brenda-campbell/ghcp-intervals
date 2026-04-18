// Client-side structured logging service
// Console-based for now — easy to upgrade to App Insights later

const RATE_LIMIT_MS = 2000;
const recentErrors = new Map<string, number>();

function getSessionId(): string {
  try {
    return localStorage.getItem("ff_userId") ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

function baseMetadata(): Record<string, string> {
  return {
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const last = recentErrors.get(key);
  if (last && now - last < RATE_LIMIT_MS) return true;
  recentErrors.set(key, now);
  // Prune old entries periodically
  if (recentErrors.size > 100) {
    for (const [k, v] of recentErrors) {
      if (now - v > RATE_LIMIT_MS * 5) recentErrors.delete(k);
    }
  }
  return false;
}

export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, string>,
): void {
  const errorMsg =
    error instanceof Error ? error.message : String(error);
  const key = `${context}:${errorMsg}`;
  if (isRateLimited(key)) return;

  const entry = {
    level: "error",
    context,
    message: errorMsg,
    stack: error instanceof Error ? error.stack : undefined,
    ...baseMetadata(),
    ...metadata,
  };
  console.error("[FF Error]", JSON.stringify(entry));
}

export function logEvent(
  event: string,
  metadata?: Record<string, string>,
): void {
  const entry = {
    level: "info",
    event,
    ...baseMetadata(),
    ...metadata,
  };
  console.info("[FF Event]", JSON.stringify(entry));
}

export function logApiCall(
  endpoint: string,
  durationMs: number,
  success: boolean,
  statusCode?: number,
  metadata?: Record<string, string>,
): void {
  const entry = {
    level: success ? "info" : "warn",
    type: "api_call",
    endpoint,
    durationMs: Math.round(durationMs),
    success,
    statusCode,
    ...baseMetadata(),
    ...metadata,
  };
  if (success) {
    console.info("[FF API]", JSON.stringify(entry));
  } else {
    console.warn("[FF API]", JSON.stringify(entry));
  }
}
