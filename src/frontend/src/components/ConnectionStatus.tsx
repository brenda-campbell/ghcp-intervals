import { useSignalRContext } from "@/contexts/SignalRContext";
import type { ConnectionState } from "@/hooks/useSignalR";
import { cn } from "@/lib/utils";

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

  return (
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
  );
}
