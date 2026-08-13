import { useEffect, useRef, useState } from "react";
import { useSignalRContext } from "@/contexts/SignalRContext";
import type { ConnectionState } from "@/hooks/useSignalR";
import { apiUrl } from "@/services/api";
import { logError, logEvent } from "@/services/logger";
import { cn } from "@/lib/utils";

type ApiHealth = "connected" | "checking" | "disconnected";

const stateConfig: Record<
  ConnectionState,
  { color: string; pulse: boolean; label: string }
> = {
  connected: { color: "bg-green-500", pulse: false, label: "Live" },
  reconnecting: { color: "bg-amber-400", pulse: true, label: "Reconnecting" },
  connecting: { color: "bg-amber-400", pulse: true, label: "Connecting" },
  disconnected: { color: "bg-red-500", pulse: false, label: "Offline" },
};

export function ConnectionStatus() {
  const { connectionState } = useSignalRContext();
  const config = stateConfig[connectionState];
  const [apiHealth, setApiHealth] = useState<ApiHealth>("connected");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      setApiHealth((prev) => (prev === "disconnected" ? "disconnected" : "checking"));
      try {
        const res = await fetch(apiUrl("/api/health"), { signal: AbortSignal.timeout(5000) });
        if (!cancelled) {
          if (res.ok) {
            setApiHealth((prev) => {
              if (prev === "disconnected") logEvent("api_reconnected");
              return "connected";
            });
          } else {
            setApiHealth("disconnected");
          }
        }
      } catch {
        if (!cancelled) {
          setApiHealth((prev) => {
            if (prev !== "disconnected") logError("ConnectionStatus", "API health check failed");
            return "disconnected";
          });
        }
      }
    };

    void checkHealth();

    const schedule = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Can't read state in setInterval directly — we'll re-schedule on apiHealth change
    };
    schedule();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Re-schedule polling based on current health state
  useEffect(() => {
    const pollMs = apiHealth === "disconnected" ? 5000 : 30000;
    const checkHealth = async () => {
      try {
        const res = await fetch(apiUrl("/api/health"), { signal: AbortSignal.timeout(5000) });
        setApiHealth(res.ok ? "connected" : "disconnected");
      } catch {
        setApiHealth("disconnected");
      }
    };

    const id = setInterval(() => void checkHealth(), pollMs);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [apiHealth]);

  return (
    <>
      {/* API health banner — only visible when disconnected or checking */}
      {apiHealth === "disconnected" && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          API unreachable — Reconnecting…
        </div>
      )}
      {apiHealth === "checking" && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/80 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm animate-pulse">
          Checking connection…
        </div>
      )}

      {/* SignalR status dot (existing) */}
      <div className="flex items-center gap-1.5" title={config.label}>
        <span className="relative flex h-2.5 w-2.5">
          {config.pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                config.color,
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              config.color,
            )}
          />
        </span>
        <span className="caption text-muted-foreground">{config.label}</span>
      </div>
    </>
  );
}
