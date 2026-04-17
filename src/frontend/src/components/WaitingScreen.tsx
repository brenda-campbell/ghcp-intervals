import { Lightning, Users } from "@phosphor-icons/react";

interface WaitingScreenProps {
  categoryName: string | null;
  onlineCount: number;
}

export function WaitingScreen({ categoryName, onlineCount }: WaitingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 animate-page-enter">
      {/* Pulsing lightning icon */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 border border-accent/30">
          <Lightning weight="fill" className="h-10 w-10 text-accent animate-pulse" />
        </div>
      </div>

      {/* Waiting text */}
      <h2 className="h2 mb-2 text-center">Waiting for the quiz to start…</h2>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
        The quiz host will start the next round shortly.
      </p>

      {/* Category badge */}
      {categoryName && (
        <div className="mb-4 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5">
          <span className="text-sm font-medium text-accent">{categoryName}</span>
        </div>
      )}

      {/* Online players count */}
      {onlineCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users weight="fill" className="h-4 w-4" />
          <span>
            <span className="font-mono text-foreground">{onlineCount}</span>{" "}
            player{onlineCount !== 1 ? "s" : ""} waiting
          </span>
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      )}
    </div>
  );
}
