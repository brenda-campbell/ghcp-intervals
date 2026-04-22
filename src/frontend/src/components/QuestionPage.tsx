import { useEffect, useState, useCallback, useRef } from "react";
import { QuestionCard } from "@/components/QuestionCard";
import { AnswerGrid } from "@/components/AnswerGrid";
import { AnswerFeedback } from "@/components/FeedbackOverlay";
import { RoundComplete } from "@/components/RoundComplete";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Timer, Clock, ArrowClockwise, UsersThree } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { useSignalRContext } from "@/contexts/SignalRContext";
import { cn } from "@/lib/utils";
import {
  fetchQuestions,
  submitAnswer,
  markRoundComplete,
  type Question,
  type AnswerResult,
  ApiError,
} from "@/services/api";

type Phase = "loading" | "playing" | "feedback" | "done" | "error";

export interface QuestionResultEntry {
  questionText: string;
  result: AnswerResult | null;
}

const QUESTION_COUNT = 3;
const FEEDBACK_DURATION_MS = 2000;

interface QuestionPageProps {
  onNavigateToLeaderboard?: () => void;
  isQuizStarted?: boolean;
  timerSeconds?: number;
  onQuizComplete?: (results: QuestionResultEntry[]) => void;
}

export function QuestionPage({ onNavigateToLeaderboard, isQuizStarted, timerSeconds = 10, onQuizComplete }: QuestionPageProps) {
  const { user } = useUser();
  const { playerActivity, categoryChanged } = useSignalRContext();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [questionAnimKey, setQuestionAnimKey] = useState(0);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [remaining, setRemaining] = useState(timerSeconds);

  const [roundResults, setRoundResults] = useState<QuestionResultEntry[]>([]);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timedOutRef = useRef(false);
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);
  const [timeUpNotice, setTimeUpNotice] = useState(false);

  const currentQuestion: Question | undefined = questions[currentIndex];

  const loadQuestions = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setSelectedIndex(null);
    setResult(null);
    setRemaining(timerSeconds);
    setRoundResults([]);
    setTransitioning(false);
    setQuestionAnimKey(0);
    timedOutRef.current = false;
    setTimeUpNotice(false);
    try {
      const qs = await fetchQuestions(QUESTION_COUNT);
      setQuestions(qs);
      setCurrentIndex(0);
      setPhase("playing");
      setQuestionStartTime(Date.now());
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `Server error (${err.status})`
          : "Failed to load questions";
      setError(msg);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  // Cleanup auto-advance timer
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  // Signal quiz completion to parent + fire round-complete API
  useEffect(() => {
    if (phase !== "done") return;
    if (isQuizStarted && onQuizComplete) {
      onQuizComplete(roundResults);
    }
    if (user?.userId) {
      markRoundComplete(user.userId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // When admin switches category, reload questions
  useEffect(() => {
    if (categoryChanged && phase !== "loading") {
      setPhase("loading");
      void loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryChanged]);

  // Show category change notification
  useEffect(() => {
    if (categoryChanged) {
      setCategoryNotice(`Category switched to: ${categoryChanged.categoryName}`);
      const timer = setTimeout(() => setCategoryNotice(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [categoryChanged]);

  const advanceQuestion = useCallback(() => {
    if (currentIndex + 1 >= questions.length) {
      setTransitioning(true);
      setTimeout(() => {
        setPhase("done");
        setTransitioning(false);
      }, 200);
      return;
    }
    setTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setResult(null);
      setPhase("playing");
      setQuestionStartTime(Date.now());
      setRemaining(timerSeconds);
      timedOutRef.current = false;
      setTimeUpNotice(false);
      setTransitioning(false);
      setQuestionAnimKey((k) => k + 1);
    }, 200);
  }, [currentIndex, questions.length, timerSeconds]);

  // Countdown timer (updates every 100ms while playing)
  useEffect(() => {
    if (phase !== "playing" || !questionStartTime) return;
    const id = setInterval(() => {
      const r = Math.max(0, timerSeconds - (Date.now() - questionStartTime) / 1000);
      setRemaining(r);
    }, 100);
    return () => clearInterval(id);
  }, [phase, questionStartTime, timerSeconds]);

  // Auto-timeout when countdown reaches 0
  useEffect(() => {
    if (remaining > 0 || phase !== "playing" || timedOutRef.current || !currentQuestion) return;
    timedOutRef.current = true;
    setTimeUpNotice(true);

    // Record as incorrect locally (no API call — timed out)
    setRoundResults((prev) => [
      ...prev,
      {
        questionText: currentQuestion.questionText,
        result: {
          correct: false,
          correctAnswer: "",
          correctIndex: -1,
          elapsedTimeMs: timerSeconds * 1000,
          timeTaken: timerSeconds,
          pointsAwarded: 0,
        },
      },
    ]);
    setPhase("feedback");

    autoAdvanceTimer.current = setTimeout(() => {
      setTimeUpNotice(false);
      advanceQuestion();
    }, 1000);
  }, [remaining, phase, currentQuestion, timerSeconds, advanceQuestion]);

  const handleSelect = async (optionIndex: number) => {
    if (submitting || selectedIndex !== null || !currentQuestion || timedOutRef.current) return;

    setSelectedIndex(optionIndex);
    setSubmitting(true);

    // Send the time the question was displayed, not the click time,
    // so the backend can compute actual think-time (not just network latency).
    const clientTimestamp = questionStartTime;

    try {
      const res = await submitAnswer({
        questionId: currentQuestion.id,
        userId: user?.userId ?? "anonymous",
        selectedOption: optionIndex,
        clientTimestamp,
      });
      setResult(res);
      setRoundResults((prev) => [
        ...prev,
        { questionText: currentQuestion.questionText, result: res },
      ]);
      setPhase("feedback");

      autoAdvanceTimer.current = setTimeout(() => {
        advanceQuestion();
      }, FEEDBACK_DURATION_MS);
    } catch {
      setResult(null);
      setRoundResults((prev) => [
        ...prev,
        { questionText: currentQuestion.questionText, result: null },
      ]);
      setPhase("feedback");

      autoAdvanceTimer.current = setTimeout(() => {
        advanceQuestion();
      }, FEEDBACK_DURATION_MS);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualAdvance = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    advanceQuestion();
  };

  if (phase === "loading") {
    return (
      <div className="animate-skeleton-shimmer space-y-6">
        <Card className="border-border/50 bg-card">
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-6 w-3/4 bg-muted" />
            <Skeleton className="h-5 w-full bg-muted" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 bg-muted" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <Card className="animate-page-enter border-destructive/50 bg-card">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <p className="ui-label text-destructive">{error}</p>
          <Button
            onClick={() => void loadQuestions()}
            variant="outline"
            className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
          >
            <ArrowClockwise weight="regular" className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done") {
    // Admin-started quiz: show completion + waiting state (no "Play Again")
    if (isQuizStarted) {
      const totalCorrect = roundResults.filter((r) => r.result?.correct).length;
      const totalPoints = roundResults.reduce(
        (sum, r) => sum + (r.result?.pointsAwarded ?? 0),
        0,
      );
      const correctTimes = roundResults
        .filter((r) => r.result?.correct)
        .map((r) => r.result!.elapsedTimeMs);
      const fastestTime = correctTimes.length > 0 ? Math.min(...correctTimes) : null;
      return (
        <div className="animate-fade-slide-in">
          <Card className="border-accent/30 bg-card shadow-lg">
            <CardContent className="flex flex-col items-center gap-6 pt-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
                <span className="text-3xl">✅</span>
              </div>
              <h2 className="h2 text-center">Quiz Complete!</h2>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Waiting for the next round…
              </p>

              {/* Score summary */}
              <div className="flex flex-col items-center gap-1">
                <span className="caption text-muted-foreground">Points Earned</span>
                <span className="h1 text-accent">{totalPoints}</span>
                <span className="ui-label text-muted-foreground">
                  {totalCorrect} / {roundResults.length} Correct
                </span>
              </div>

              {/* Per-question results with times */}
              <div className="w-full space-y-2">
                {roundResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-4 py-2 text-sm">
                    <span className={r.result?.correct ? "text-green-400" : "text-red-400"}>
                      {r.result?.correct ? "✓" : "✗"} Q{i + 1}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.result ? `${(r.result.elapsedTimeMs / 1000).toFixed(1)}s` : "—"}
                    </span>
                    <span className="font-mono text-accent">
                      {r.result?.pointsAwarded ?? 0} pts
                    </span>
                  </div>
                ))}
              </div>

              {/* Fastest correct answer */}
              {fastestTime !== null && (
                <div className="text-sm font-medium text-accent">
                  ⚡ Fastest correct answer: {(fastestTime / 1000).toFixed(1)}s
                </div>
              )}

              {/* Pulsing waiting indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock weight="regular" className="h-4 w-4 animate-pulse" />
                <span>Waiting for admin to start next round</span>
              </div>

              <Button
                onClick={() => onNavigateToLeaderboard?.()}
                variant="outline"
                size="lg"
                className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
              >
                <UsersThree weight="fill" className="mr-2 h-4 w-4" />
                View Leaderboard
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Practice/free mode: show full RoundComplete with Play Again
    return (
      <RoundComplete
        results={roundResults}
        onPlayAgain={() => void loadQuestions()}
        onViewLeaderboard={() => onNavigateToLeaderboard?.()}
      />
    );
  }

  if (!currentQuestion) return null;

  const correctAnswerText =
    result && !result.correct
      ? currentQuestion.options[result.correctIndex]
      : undefined;

  return (
    <div
      key={questionAnimKey}
      className={cn(
        "space-y-4 will-change-[opacity,transform]",
        transitioning
          ? "animate-question-slide-out"
          : "animate-question-slide-in",
      )}
    >
      {categoryNotice && (
        <div className="animate-fade-slide-in rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-center text-sm text-accent">
          {categoryNotice}
        </div>
      )}

      {timeUpNotice && (
        <div className="animate-fade-slide-in rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm font-bold text-red-400">
          ⏰ Time&apos;s up!
        </div>
      )}

      {/* Countdown timer bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="ui-label flex items-center gap-2">
            <Timer weight="fill" className="h-5 w-5" />
            <span className={cn(
              "text-2xl font-bold font-mono tabular-nums",
              remaining > 5 ? "text-green-400" : remaining > 2 ? "text-amber-400" : "text-red-400 animate-pulse"
            )}>
              {remaining.toFixed(1)}s
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            Q{currentIndex + 1}/{questions.length}
          </span>
          {playerActivity && playerActivity.playerCount > 0 && (
            <span className="ui-label flex items-center gap-1.5 text-muted-foreground animate-pulse">
              <UsersThree weight="fill" className="h-4 w-4 text-accent" />
              {playerActivity.playerCount} answering…
            </span>
          )}
        </div>
        {/* Progress bar that depletes */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-100",
              remaining > 5 ? "bg-green-500" : remaining > 2 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${(remaining / timerSeconds) * 100}%` }}
          />
        </div>
      </div>

      <QuestionCard
        questionText={currentQuestion.questionText}
        category={currentQuestion.category}
        difficulty={currentQuestion.difficulty}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
      >
        <AnswerGrid
          options={currentQuestion.options}
          selectedIndex={selectedIndex}
          disabled={submitting || phase === "feedback"}
          onSelect={(i) => void handleSelect(i)}
          correctIndex={result ? result.correctIndex : null}
          isCorrect={result ? result.correct : null}
          questionType={currentQuestion.type || "multiple-choice"}
        />

        {phase === "feedback" && result && (
          <div>
            <AnswerFeedback
              result={result}
              correctAnswerText={correctAnswerText}
            />
            <div className="mt-3 flex justify-center">
              <Button
                onClick={handleManualAdvance}
                size="sm"
                variant="ghost"
                className="text-muted-foreground transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
              >
                {currentIndex + 1 < questions.length
                  ? "Next \u2192"
                  : "See Results \u2192"}
              </Button>
            </div>
          </div>
        )}

        {phase === "feedback" && !result && (
          <div className="animate-fade-slide-in mt-4 flex flex-col items-center gap-3">
            <p className="ui-label text-muted-foreground">
              Answer submitted (offline mode)
            </p>
            <Button
              onClick={handleManualAdvance}
              size="sm"
              variant="ghost"
              className="text-muted-foreground transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
            >
              {currentIndex + 1 < questions.length
                ? "Next \u2192"
                : "See Results \u2192"}
            </Button>
          </div>
        )}
      </QuestionCard>
    </div>
  );
}
