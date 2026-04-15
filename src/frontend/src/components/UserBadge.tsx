import { useEffect, useRef, useState } from "react";
import { User as UserIcon, Trophy, TrendUp } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/contexts/UserContext";

export function UserBadge() {
  const { user, isLoading, error } = useUser();
  const prevScoreRef = useRef(0);
  const [scoreDelta, setScoreDelta] = useState(0);

  useEffect(() => {
    if (!user) return;
    if (user.totalScore > prevScoreRef.current && prevScoreRef.current > 0) {
      setScoreDelta(user.totalScore - prevScoreRef.current);
    }
    prevScoreRef.current = user.totalScore;
  }, [user]);

  useEffect(() => {
    if (scoreDelta <= 0) return;
    const timer = setTimeout(() => setScoreDelta(0), 1400);
    return () => clearTimeout(timer);
  }, [scoreDelta]);

  if (isLoading) {
    return <Skeleton className="h-7 w-32 rounded-full" />;
  }

  if (error || !user) {
    return (
      <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-xs">
        <UserIcon weight="bold" className="size-3.5" />
        Offline
      </Badge>
    );
  }

  return (
    <div className="relative">
      <Badge
        variant="secondary"
        className="max-w-[180px] gap-1.5 px-2 py-1 text-xs transition-transform duration-150 hover:scale-[1.03] sm:max-w-none sm:px-3"
      >
        <UserIcon weight="bold" className="size-3.5 shrink-0" />
        <span className="truncate">{user.displayName}</span>
        <span className="shrink-0 text-muted-foreground">|</span>
        <Trophy weight="bold" className="size-3.5 shrink-0 text-accent" />
        <span className="shrink-0 font-mono">{user.totalScore}</span>
      </Badge>
      {scoreDelta > 0 && (
        <span
          className="pointer-events-none absolute -top-3 right-0 inline-flex items-center gap-0.5 font-mono text-xs font-bold text-accent"
          style={{ animation: "score-float-up 1.2s ease-out forwards" }}
        >
          <TrendUp weight="bold" className="size-3" />
          +{scoreDelta}
        </span>
      )}
    </div>
  );
}
