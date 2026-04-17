import { useCallback, useEffect, useState } from "react";
import {
  ShieldStar,
  SpinnerGap,
  ArrowClockwise,
  WarningCircle,
  CheckCircle,
  XCircle,
  Trash,
  Tag,
  ListBullets,
  Plus,
  PencilSimple,
  Broadcast,
  Play,
  Stop,
  Eraser,
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
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { useSignalRContext } from "@/contexts/SignalRContext";
import {
  listUsers,
  toggleUserStatus,
  deleteUser,
  resetScores,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory as deleteCategoryApi,
  getGameState,
  setActiveCategory,
  getOnlinePlayers,
  startQuiz,
  stopQuiz,
  setQuestionCount,
  setTimer,
  setRegistration,
  type User,
  type Category,
  type GameState,
  type QuestionType,
  type OnlinePlayersResponse,
} from "@/services/api";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Quiz Control (Start / Stop)                                       */
/* ------------------------------------------------------------------ */

function QuizControlSection({ adminUserId }: { adminUserId: string }) {
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [isRegOpen, setIsRegOpen] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegSaving, setIsRegSaving] = useState(false);
  const [questionCount, setQuestionCountState] = useState<number>(3);
  const [timerSecs, setTimerSecsState] = useState<number>(10);
  const { quizStarted, registrationOpen } = useSignalRContext();

  // Fetch initial state
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const gs = await getGameState();
        if (!cancelled) {
          setIsStarted(gs.isStarted ?? false);
          setIsRegOpen(gs.isRegistrationOpen !== false);
          if (gs.questionCount) setQuestionCountState(gs.questionCount);
          if (gs.timerSeconds) setTimerSecsState(gs.timerSeconds);
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Keep in sync with SignalR events
  useEffect(() => {
    if (quizStarted !== null) setIsStarted(quizStarted);
  }, [quizStarted]);

  useEffect(() => {
    if (registrationOpen !== null) setIsRegOpen(registrationOpen);
  }, [registrationOpen]);

  const handleToggle = async () => {
    setIsSaving(true);
    try {
      const gs = isStarted
        ? await stopQuiz(adminUserId)
        : await startQuiz(adminUserId, questionCount);
      setIsStarted(gs.isStarted ?? false);
    } catch {
      /* error handled silently — button re-enables */
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuestionCountChange = async (newCount: number) => {
    setQuestionCountState(newCount);
    try {
      await setQuestionCount(newCount, adminUserId);
    } catch {
      /* silent — optimistic update, if endpoint doesn't exist yet it's a no-op */
    }
  };

  const handleTimerChange = async (newSecs: number) => {
    setTimerSecsState(newSecs);
    try {
      await setTimer(newSecs, adminUserId);
    } catch {
      /* silent — optimistic update */
    }
  };

  const handleToggleRegistration = async () => {
    setIsRegSaving(true);
    try {
      const gs = await setRegistration(!isRegOpen, adminUserId);
      setIsRegOpen(gs.isRegistrationOpen !== false);
    } catch {
      /* silent — button re-enables */
    } finally {
      setIsRegSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="ml-auto h-9 w-28 rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
      <div
        className={cn(
          "h-3 w-3 rounded-full",
          isStarted ? "bg-green-500 animate-pulse" : "bg-red-500",
        )}
      />
      <span className="text-sm font-medium">
        Quiz is{" "}
        <span className={cn("font-semibold", isStarted ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
          {isStarted ? "LIVE" : "STOPPED"}
        </span>
      </span>

      {/* Question count selector */}
      {!isStarted && (
        <div className="flex items-center gap-1.5">
          <label htmlFor="qcount" className="text-xs text-muted-foreground whitespace-nowrap">
            Questions:
          </label>
          <select
            id="qcount"
            value={questionCount}
            onChange={(e) => void handleQuestionCountChange(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-secondary px-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Timer per question selector */}
      {!isStarted && (
        <div className="flex items-center gap-1.5">
          <label htmlFor="qtimer" className="text-xs text-muted-foreground whitespace-nowrap">
            Timer:
          </label>
          <select
            id="qtimer"
            value={timerSecs}
            onChange={(e) => void handleTimerChange(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-secondary px-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            {[5, 10, 15, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n}s
              </option>
            ))}
          </select>
        </div>
      )}

      {isStarted && (
        <span className="text-xs text-muted-foreground">
          ({questionCount} questions, {timerSecs}s timer)
        </span>
      )}

      <div className="flex items-center gap-3 ml-auto">
        <span className="text-sm">Registration:</span>
        <Button
          size="sm"
          variant={isRegOpen ? "default" : "destructive"}
          disabled={isRegSaving}
          onClick={() => void handleToggleRegistration()}
        >
          {isRegSaving ? (
            <SpinnerGap className="mr-1 size-3.5 animate-spin" />
          ) : null}
          {isRegOpen ? "🔓 Open" : "🔒 Closed"}
        </Button>
      </div>

      <Button
        size="sm"
        onClick={() => void handleToggle()}
        disabled={isSaving}
        className={cn(
          "min-h-[36px] font-semibold transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]",
          isStarted
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-green-500 hover:bg-green-600 text-white",
        )}
      >
        {isSaving ? (
          <SpinnerGap className="mr-1.5 size-4 animate-spin" />
        ) : isStarted ? (
          <Stop weight="fill" className="mr-1.5 size-4" />
        ) : (
          <Play weight="fill" className="mr-1.5 size-4" />
        )}
        {isStarted ? "Stop Quiz" : "Start Quiz"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Online Players (auto-refresh)                                     */
/* ------------------------------------------------------------------ */

function OnlinePlayersSection({ adminUserId }: { adminUserId: string }) {
  const [data, setData] = useState<OnlinePlayersResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getOnlinePlayers(adminUserId);
        if (!cancelled) setData(res);
      } catch {
        /* silent — non-critical */
      }
    };
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [adminUserId]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
      <Broadcast weight="fill" className="size-4 text-green-600 dark:text-green-400" />
      <span className="text-sm font-medium">
        Online Players:{" "}
        <span className="font-mono text-accent">{data?.count ?? "—"}</span>
      </span>
      {data?.players && data.players.length > 0 && (
        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
          {data.players.map((p) => p.displayName).join(", ")}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Active Category Switcher                                          */
/* ------------------------------------------------------------------ */

function ActiveCategorySwitcher({
  adminUserId,
  categories,
  gameState,
  onGameStateChange,
}: {
  adminUserId: string;
  categories: Category[];
  gameState: GameState | null;
  onGameStateChange: (gs: GameState) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSetActive = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      const gs = await setActiveCategory(selectedId, adminUserId);
      onGameStateChange(gs);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch {
      /* error handled upstream */
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
      <Tag weight="fill" className="size-4 text-accent" />
      <span className="text-sm font-medium">Active Category:</span>
      {gameState?.activeCategoryName ? (
        <Badge className="bg-accent/20 text-accent">{gameState.activeCategoryName}</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">None set</span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Choose category…</option>
          {categories
            .filter((c) => c.isActive)
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
        <Button
          size="sm"
          onClick={() => void handleSetActive()}
          disabled={!selectedId || isSaving}
          className="min-h-[36px] bg-accent text-background font-semibold transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
        >
          {isSaving ? (
            <SpinnerGap className="mr-1 size-3.5 animate-spin" />
          ) : (
            <CheckCircle weight="bold" className="mr-1 size-3.5" />
          )}
          Set Active
        </Button>
        {showSuccess && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle weight="fill" className="size-3.5" /> Updated!
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category Management Card                                          */
/* ------------------------------------------------------------------ */

function CategoryManagement({ adminUserId }: { adminUserId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFormat, setNewFormat] = useState<QuestionType>("multiple-choice");
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editFormat, setEditFormat] = useState<QuestionType>("multiple-choice");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, gs] = await Promise.all([
        listCategories(adminUserId),
        getGameState(),
      ]);
      setCategories(cats);
      setGameState(gs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, [adminUserId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const cat = await createCategory(newName.trim(), newDesc.trim(), newFormat, adminUserId);
      setCategories((prev) => [...prev, cat]);
      setNewName("");
      setNewDesc("");
      setNewFormat("multiple-choice");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
    setDeletingId(cat.id);
    try {
      await deleteCategoryApi(cat.id, adminUserId);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    setTogglingId(cat.id);
    try {
      const updated = await updateCategory(cat.id, { isActive: !cat.isActive }, adminUserId);
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setTogglingId(null);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description);
    setEditFormat(cat.questionFormat);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setIsSavingEdit(true);
    try {
      const updated = await updateCategory(
        editingId,
        { name: editName.trim(), description: editDesc.trim(), questionFormat: editFormat },
        adminUserId,
      );
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Card className="border-border bg-card">
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {/* Active Category Switcher */}
      <ActiveCategorySwitcher
        adminUserId={adminUserId}
        categories={categories}
        gameState={gameState}
        onGameStateChange={setGameState}
      />

      {/* Category CRUD Card */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListBullets weight="fill" className="size-5 text-accent" />
            Category Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
            >
              <ArrowClockwise className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setShowForm((v) => !v)}
              className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
            >
              <Plus weight="bold" className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <WarningCircle weight="bold" className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Create form */}
          {showForm && (
            <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Category name *"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <select
                  value={newFormat}
                  onChange={(e) => setNewFormat(e.target.value as QuestionType)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="true-false">True / False</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={!newName.trim() || isCreating}
                  className="min-h-[36px] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
                >
                  {isCreating ? (
                    <SpinnerGap className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <Plus weight="bold" className="mr-1 size-3.5" />
                  )}
                  Create
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Category table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Format</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Questions</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No categories yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
                {categories.map((cat, i) => {
                  const isActiveCat = gameState?.activeCategoryId === cat.id;
                  const isToggling = togglingId === cat.id;
                  const isDeleting = deletingId === cat.id;
                  const isEditing = editingId === cat.id;

                  return (
                    <TableRow
                      key={cat.id}
                      className={cn(
                        i % 2 === 0 ? "bg-muted/20" : "",
                        isActiveCat && "border-l-2 border-l-accent",
                      )}
                      style={{
                        animation: `row-enter 350ms ease-out ${i * 50}ms backwards`,
                      }}
                    >
                      <TableCell>
                        {isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 w-full rounded border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Description"
                              className="h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="max-w-[150px] truncate sm:max-w-none font-sans">
                              {cat.name}
                            </span>
                            {isActiveCat && (
                              <Badge className="bg-accent/20 text-accent text-[10px] px-1.5 py-0">
                                LIVE
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                        {isEditing ? (
                          <select
                            value={editFormat}
                            onChange={(e) => setEditFormat(e.target.value as QuestionType)}
                            className="h-7 rounded border border-border bg-background px-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                          >
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="true-false">True / False</option>
                          </select>
                        ) : (
                          cat.questionFormat === "true-false" ? "True/False" : "Multiple Choice"
                        )}
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-right font-mono">
                        {cat.questionCount ?? "—"}
                      </TableCell>

                      <TableCell className="text-center">
                        <button
                          onClick={() => void handleToggleActive(cat)}
                          disabled={isToggling}
                          title={cat.isActive ? "Deactivate category" : "Activate category"}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-150",
                            cat.isActive
                              ? "bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25"
                              : "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25",
                            isToggling && "cursor-not-allowed opacity-50",
                            !isToggling && "hover:scale-[1.05] active:scale-[0.95]",
                          )}
                        >
                          {isToggling ? (
                            <SpinnerGap className="size-3.5 animate-spin" />
                          ) : cat.isActive ? (
                            <CheckCircle weight="fill" className="size-3.5" />
                          ) : (
                            <XCircle weight="fill" className="size-3.5" />
                          )}
                          {cat.isActive ? "Active" : "Inactive"}
                        </button>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => void handleSaveEdit()}
                                disabled={isSavingEdit || !editName.trim()}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25 transition-all duration-150 hover:scale-[1.05] active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSavingEdit ? (
                                  <SpinnerGap className="size-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle weight="fill" className="size-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted/40 text-muted-foreground hover:bg-muted/60 transition-all duration-150 hover:scale-[1.05] active:scale-[0.95]"
                              >
                                <XCircle weight="fill" className="size-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(cat)}
                                title="Edit category"
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-all duration-150 hover:scale-[1.05] active:scale-[0.95]"
                              >
                                <PencilSimple weight="fill" className="size-3.5" />
                              </button>
                              <button
                                onClick={() => void handleDelete(cat)}
                                disabled={isDeleting}
                                title="Delete category"
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-150",
                                  "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25",
                                  isDeleting && "cursor-not-allowed opacity-50",
                                  !isDeleting && "hover:scale-[1.05] active:scale-[0.95]",
                                )}
                              >
                                {isDeleting ? (
                                  <SpinnerGap className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash weight="fill" className="size-3.5" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"} total
          </p>
        </CardContent>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Score Reset Management                                            */
/* ------------------------------------------------------------------ */

function ScoreResetSection({
  adminUserId,
  categories,
  userCount,
  onResetComplete,
}: {
  adminUserId: string;
  categories: Category[];
  userCount: number;
  onResetComplete: () => void;
}) {
  const [isResetting, setIsResetting] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const clearFeedback = () => {
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleResetAll = async () => {
    setIsResetting(true);
    setFeedback(null);
    try {
      const result = await resetScores(
        adminUserId,
        "all",
        undefined,
        categoryId || undefined,
      );
      setFeedback({
        type: "success",
        message: `Reset complete — ${result.usersAffected} user${result.usersAffected !== 1 ? "s" : ""} affected`,
      });
      setConfirmingAll(false);
      onResetComplete();
      clearFeedback();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reset scores",
      });
      clearFeedback();
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eraser weight="fill" className="size-5 text-red-600 dark:text-red-400" />
          Score Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedback && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              feedback.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {feedback.type === "success" ? (
              <CheckCircle weight="bold" className="size-4 shrink-0" />
            ) : (
              <WarningCircle weight="bold" className="size-4 shrink-0" />
            )}
            {feedback.message}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {/* Category filter */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Scope (optional)</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Reset All button + confirmation */}
          {!confirmingAll ? (
            <Button
              size="sm"
              onClick={() => setConfirmingAll(true)}
              className="min-h-[36px] bg-red-500 hover:bg-red-600 text-white font-semibold transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
            >
              <Eraser weight="bold" className="mr-1.5 size-4" />
              Reset All Scores
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <WarningCircle weight="fill" className="size-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-sm text-red-600 dark:text-red-300">
                Reset scores for {userCount} user{userCount !== 1 ? "s" : ""}
                {categoryId ? " in selected category" : ""}?
              </span>
              <Button
                size="sm"
                onClick={() => void handleResetAll()}
                disabled={isResetting}
                className="min-h-[32px] bg-red-500 hover:bg-red-600 text-white font-semibold text-xs"
              >
                {isResetting ? (
                  <SpinnerGap className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <CheckCircle weight="bold" className="mr-1 size-3.5" />
                )}
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingAll(false)}
                disabled={isResetting}
                className="min-h-[32px] text-xs"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main AdminPanel                                                   */
/* ------------------------------------------------------------------ */

export function AdminPanel() {
  const { user: currentUser } = useUser();
  const { scoresResetSignal } = useSignalRContext();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isResettingSelected, setIsResettingSelected] = useState(false);
  const [confirmingSelected, setConfirmingSelected] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchUsers = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const [data, cats] = await Promise.all([
        listUsers(currentUser.userId),
        listCategories(currentUser.userId),
      ]);
      setUsers(data.users);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Refresh user list when scores are reset via SignalR
  useEffect(() => {
    if (scoresResetSignal) void fetchUsers();
  }, [scoresResetSignal, fetchUsers]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map((u) => u.userId)));
    }
  };

  const handleResetSelected = async () => {
    if (!currentUser || selectedUserIds.size === 0) return;
    setIsResettingSelected(true);
    setResetFeedback(null);
    try {
      const result = await resetScores(
        currentUser.userId,
        "selected",
        Array.from(selectedUserIds),
      );
      setResetFeedback({
        type: "success",
        message: `Reset complete — ${result.usersAffected} user${result.usersAffected !== 1 ? "s" : ""} affected`,
      });
      setSelectedUserIds(new Set());
      setConfirmingSelected(false);
      void fetchUsers();
      setTimeout(() => setResetFeedback(null), 3000);
    } catch (err) {
      setResetFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reset scores",
      });
      setTimeout(() => setResetFeedback(null), 3000);
    } finally {
      setIsResettingSelected(false);
    }
  };

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

  const handleDelete = async (targetUser: User) => {
    if (!currentUser || targetUser.userId === currentUser.userId) return;
    if (!window.confirm(`Delete ${targetUser.displayName}? This cannot be undone.`)) return;
    setDeletingId(targetUser.userId);
    try {
      await deleteUser(targetUser.userId, currentUser.userId);
      setUsers((prev) => prev.filter((u) => u.userId !== targetUser.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  const userCard = isLoading ? (
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
  ) : error && users.length === 0 ? (
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
  ) : (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldStar weight="fill" className="size-5 text-accent" />
          User Management
        </CardTitle>
        <div className="flex items-center gap-2">
          {selectedUserIds.size > 0 && !confirmingSelected && (
            <Button
              size="sm"
              onClick={() => setConfirmingSelected(true)}
              className="min-h-[32px] bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
            >
              <Eraser weight="bold" className="mr-1 size-3.5" />
              Reset Selected ({selectedUserIds.size})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchUsers}
            className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
          >
            <ArrowClockwise className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <WarningCircle weight="bold" className="size-4 shrink-0" />
            {error}
          </div>
        )}
        {resetFeedback && (
          <div
            className={cn(
              "mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              resetFeedback.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {resetFeedback.type === "success" ? (
              <CheckCircle weight="bold" className="size-4 shrink-0" />
            ) : (
              <WarningCircle weight="bold" className="size-4 shrink-0" />
            )}
            {resetFeedback.message}
          </div>
        )}
        {confirmingSelected && selectedUserIds.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <WarningCircle weight="fill" className="size-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-sm text-red-600 dark:text-red-300">
              Reset scores for {selectedUserIds.size} selected user{selectedUserIds.size !== 1 ? "s" : ""}?
            </span>
            <Button
              size="sm"
              onClick={() => void handleResetSelected()}
              disabled={isResettingSelected}
              className="min-h-[32px] bg-red-500 hover:bg-red-600 text-white font-semibold text-xs"
            >
              {isResettingSelected ? (
                <SpinnerGap className="mr-1 size-3.5 animate-spin" />
              ) : (
                <CheckCircle weight="bold" className="mr-1 size-3.5" />
              )}
              Confirm Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingSelected(false)}
              disabled={isResettingSelected}
              className="min-h-[32px] text-xs"
            >
              Cancel
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUserIds.size === users.length}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-border accent-accent cursor-pointer"
                    title="Select all"
                  />
                </TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="hidden md:table-cell text-right">Games</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u, i) => {
                const isActive = u.isActive !== false;
                const isSelf = u.userId === currentUser?.userId;
                const isToggling = togglingId === u.userId;
                const isDeleting = deletingId === u.userId;

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
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(u.userId)}
                        onChange={() => toggleUserSelection(u.userId)}
                        className="size-4 rounded border-border accent-accent cursor-pointer"
                      />
                    </TableCell>
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
                            ? "bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25"
                            : "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25",
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
                    <TableCell className="text-center">
                      <button
                        onClick={() => void handleDelete(u)}
                        disabled={isSelf || isDeleting}
                        title={isSelf ? "Cannot delete yourself" : "Delete user"}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-150",
                          "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25",
                          (isSelf || isDeleting) && "cursor-not-allowed opacity-50",
                          !isSelf && !isDeleting && "hover:scale-[1.05] active:scale-[0.95]",
                        )}
                      >
                        {isDeleting ? (
                          <SpinnerGap className="size-3.5 animate-spin" />
                        ) : (
                          <Trash weight="fill" className="size-3.5" />
                        )}
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

  return (
    <div className="space-y-4">
      {/* 0. Quiz Control */}
      {currentUser && <QuizControlSection adminUserId={currentUser.userId} />}

      {/* 1. Online Players */}
      {currentUser && <OnlinePlayersSection adminUserId={currentUser.userId} />}

      {/* 2. Category Management + Active Switcher */}
      {currentUser && <CategoryManagement adminUserId={currentUser.userId} />}

      {/* 3. Score Management */}
      {currentUser && (
        <ScoreResetSection
          adminUserId={currentUser.userId}
          categories={categories}
          userCount={users.length}
          onResetComplete={() => void fetchUsers()}
        />
      )}

      {/* 4. User Management */}
      {userCard}
    </div>
  );
}
