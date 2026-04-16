import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowClockwise, Trophy, Warning, Broadcast } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/Leaderboard";
import { getLeaderboard, listCategories, type LeaderboardEntry, type Category } from "@/services/api";
import { useSignalRContext } from "@/contexts/SignalRContext";

const REFRESH_INTERVAL_MS = 30_000;

interface LeaderboardPageProps {
  userId?: string;
}

export function LeaderboardPage({ userId }: LeaderboardPageProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ entry: LeaderboardEntry; rank: number } | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { connectionState, leaderboardData } = useSignalRContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();

  const isLive = connectionState === "connected";

  // Fetch categories on mount
  useEffect(() => {
    listCategories().then(cats => setCategories(cats.filter(c => c.isActive))).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await getLeaderboard(userId, selectedCategoryId);
      setEntries(data.leaderboard);
      setUserRank(data.userRank);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load leaderboard";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedCategoryId]);

  // Real-time leaderboard updates from SignalR
  useEffect(() => {
    if (leaderboardData && leaderboardData.length > 0) {
      setEntries(leaderboardData);
      setLastUpdated(new Date());
    }
  }, [leaderboardData]);

  // Polling: only when SignalR is not connected (fallback)
  useEffect(() => {
    void fetchData();

    if (!isLive) {
      intervalRef.current = setInterval(() => {
        void fetchData();
      }, REFRESH_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, isLive]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy weight="fill" className="size-6 text-primary" />
          <h2 className="h2">Leaderboard</h2>
        </div>
        <div className="animate-skeleton-shimmer rounded-lg border border-border bg-card p-4">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-6 w-14 rounded-full bg-muted" />
                <Skeleton className="h-5 w-32 bg-muted" />
                <div className="ml-auto flex gap-4">
                  <Skeleton className="h-5 w-16 bg-muted" />
                  <Skeleton className="hidden h-5 w-12 bg-muted sm:block" />
                  <Skeleton className="hidden h-5 w-16 bg-muted md:block" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy weight="fill" className="size-6 text-primary" />
          <h2 className="h2">Leaderboard</h2>
        </div>
        <Alert variant="destructive">
          <Warning weight="fill" className="size-4" />
          <AlertTitle>Failed to load leaderboard</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
              onClick={() => {
                setIsLoading(true);
                void fetchData();
              }}
            >
              <ArrowClockwise className="size-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy weight="fill" className="size-6 text-primary" />
          <h2 className="h2">Leaderboard</h2>
          {isLive && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
              <Broadcast weight="fill" className="size-3" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedCategoryId ?? ""}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value || undefined);
                setIsLoading(true);
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          {lastUpdated && (
            <span className="caption text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {entries.length === 0 ? (
          <p className="body-mono p-8 text-center text-muted-foreground">
            No scores yet. Be the first to play!
          </p>
        ) : (
          <Leaderboard
            entries={entries}
            currentUserId={userId}
            userRank={userRank}
          />
        )}
      </div>
    </div>
  );
}
