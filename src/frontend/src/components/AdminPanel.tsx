import { useCallback, useEffect, useState } from "react";
import {
  ShieldStar,
  SpinnerGap,
  ArrowClockwise,
  WarningCircle,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/contexts/UserContext";
import { listUsers, toggleUserStatus, type User } from "@/services/api";
import { cn } from "@/lib/utils";

export function AdminPanel() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await listUsers(currentUser.userId);
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleToggle = async (targetUser: User) => {
    if (!currentUser || targetUser.userId === currentUser.userId) return;
    setTogglingId(targetUser.userId);
    try {
      const updated = await toggleUserStatus(
        targetUser.userId,
        !(targetUser.isActive !== false),
        currentUser.userId,
      );
      setUsers((prev) =>
        prev.map((u) => (u.userId === updated.userId ? updated : u)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status");
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error && users.length === 0) {
    return (
      <Card className="border-destructive/30 bg-card">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <WarningCircle weight="fill" className="h-10 w-10 text-destructive" />
          <p className="caption text-destructive">{error}</p>
          <Button
            variant="outline"
            onClick={fetchUsers}
            className="min-h-[44px] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
          >
            <ArrowClockwise className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldStar weight="fill" className="size-5 text-accent" />
          User Management
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchUsers}
          className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
        >
          <ArrowClockwise className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <WarningCircle weight="bold" className="size-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="hidden md:table-cell text-right">Games</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u, i) => {
                const isActive = u.isActive !== false;
                const isSelf = u.userId === currentUser?.userId;
                const isToggling = togglingId === u.userId;

                return (
                  <TableRow
                    key={u.userId}
                    className={cn(
                      i % 2 === 0 ? "bg-muted/20" : "",
                      isSelf && "border-l-2 border-l-accent",
                      !isActive && "opacity-60",
                    )}
                    style={{
                      animation: `row-enter 350ms ease-out ${i * 50}ms backwards`,
                    }}
                  >
                    <TableCell className="font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-[120px] truncate sm:max-w-none">
                          {u.displayName}
                        </span>
                        {u.isAdmin && (
                          <ShieldStar
                            weight="fill"
                            className="size-3.5 shrink-0 text-accent"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      <span className="max-w-[180px] truncate block text-xs">
                        {u.email ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{u.totalScore}</TableCell>
                    <TableCell className="hidden md:table-cell text-right font-mono">
                      {u.gamesPlayed}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => void handleToggle(u)}
                        disabled={isSelf || isToggling}
                        title={
                          isSelf
                            ? "Cannot change your own status"
                            : isActive
                              ? "Deactivate user"
                              : "Activate user"
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-150",
                          isActive
                            ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                            : "bg-red-500/15 text-red-400 hover:bg-red-500/25",
                          (isSelf || isToggling) && "cursor-not-allowed opacity-50",
                          !isSelf && !isToggling && "hover:scale-[1.05] active:scale-[0.95]",
                        )}
                      >
                        {isToggling ? (
                          <SpinnerGap className="size-3.5 animate-spin" />
                        ) : isActive ? (
                          <CheckCircle weight="fill" className="size-3.5" />
                        ) : (
                          <XCircle weight="fill" className="size-3.5" />
                        )}
                        {isActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {users.length} user{users.length !== 1 ? "s" : ""} total
        </p>
      </CardContent>
    </Card>
  );
}
