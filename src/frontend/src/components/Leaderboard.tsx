import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { RankBadge } from "@/components/RankBadge";
import type { LeaderboardEntry } from "@/services/api";

function formatTime(ms: number): string {
  if (ms <= 0) return "\u2014";
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Animates a number counting up with an ease-out curve */
function AnimatedScore({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) {
      setDisplayed(value);
      return;
    }
    const duration = 800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + diff * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{displayed.toLocaleString()}</>;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  userRank?: { entry: LeaderboardEntry; rank: number };
}

export function Leaderboard({ entries, currentUserId, userRank }: LeaderboardProps) {
  const isCurrentUserInTop = entries.some((e) => e.userId === currentUserId);
  const showSeparateUserRow = userRank && !isCurrentUserInTop;

  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow className="border-border/60 hover:bg-transparent">
          <TableHead className="w-16 font-sans text-xs uppercase tracking-wider text-muted-foreground sm:w-20">
            Rank
          </TableHead>
          <TableHead className="max-w-[120px] font-sans text-xs uppercase tracking-wider text-muted-foreground sm:max-w-none">
            Player
          </TableHead>
          <TableHead className="text-right font-sans text-xs uppercase tracking-wider text-muted-foreground">
            Score
          </TableHead>
          <TableHead className="hidden text-right font-sans text-xs uppercase tracking-wider text-muted-foreground sm:table-cell">
            Games
          </TableHead>
          <TableHead className="hidden text-right font-sans text-xs uppercase tracking-wider text-muted-foreground md:table-cell">
            Fastest
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, i) => {
          const isMe = entry.userId === currentUserId;
          const isFirst = entry.rank === 1;
          return (
            <TableRow
              key={entry.userId}
              style={{
                animation: isFirst
                  ? `row-enter 350ms ease-out ${i * 50}ms backwards, shimmer-glow 3s 500ms ease-in-out infinite`
                  : `row-enter 350ms ease-out ${i * 50}ms backwards`,
              }}
              className={cn(
                "border-border/30 transition-colors will-change-[opacity,transform]",
                isMe && "bg-accent/10 border-l-2 border-l-accent",
                !isMe && i % 2 === 1 && "bg-muted/20",
                entry.rank <= 3 && "hover:bg-muted/40",
              )}
            >
              <TableCell>
                <RankBadge rank={entry.rank} />
              </TableCell>
              <TableCell
                className={cn(
                  "max-w-[120px] font-sans font-medium sm:max-w-none",
                  isMe && "text-accent",
                )}
              >
                <span className="block truncate">
                  {entry.displayName}
                  {isMe && (
                    <span className="ml-1 text-xs text-accent/70">(you)</span>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                <AnimatedScore value={entry.totalScore} />
              </TableCell>
              <TableCell className="hidden text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                {entry.gamesPlayed}
              </TableCell>
              <TableCell className="hidden text-right font-mono tabular-nums text-muted-foreground md:table-cell">
                {formatTime(entry.fastestTimeMs)}
              </TableCell>
            </TableRow>
          );
        })}

        {showSeparateUserRow && (
          <>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="p-0">
                <div className="flex items-center gap-3 px-2 py-1">
                  <Separator className="flex-1" />
                  <span className="caption text-muted-foreground">your rank</span>
                  <Separator className="flex-1" />
                </div>
              </TableCell>
            </TableRow>
            <TableRow
              style={{
                animation: `row-enter 350ms ease-out ${entries.length * 50}ms backwards`,
              }}
              className="border-l-2 border-l-accent bg-accent/10 will-change-[opacity,transform]"
            >
              <TableCell>
                <RankBadge rank={userRank.rank} />
              </TableCell>
              <TableCell className="max-w-[120px] font-sans font-medium text-accent sm:max-w-none">
                <span className="block truncate">
                  {userRank.entry.displayName}
                  <span className="ml-1 text-xs text-accent/70">(you)</span>
                </span>
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                <AnimatedScore value={userRank.entry.totalScore} />
              </TableCell>
              <TableCell className="hidden text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                {userRank.entry.gamesPlayed}
              </TableCell>
              <TableCell className="hidden text-right font-mono tabular-nums text-muted-foreground md:table-cell">
                {formatTime(userRank.entry.fastestTimeMs)}
              </TableCell>
            </TableRow>
          </>
        )}
      </TableBody>
    </Table>
    </div>
  );
}
