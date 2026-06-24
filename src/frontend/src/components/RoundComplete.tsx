import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Lightning,
  ArrowClockwise,
  Trophy,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { AnswerResult } from "@/services/api";
import { HowScoringWorksDialog } from "@/components/HowScoringWorksDialog";

interface QuestionResult {
  questionText: string;
  result: AnswerResult | null;
}

interface RoundCompleteProps {
  results: QuestionResult[];
  onPlayAgain: () => void;
  onViewLeaderboard: () => void;
}

function ConfettiPiece({ index }: { index: number }) {
  const colors = ["#C5F542", "#4A90E2", "#22C55E", "#FACC15", "#F472B6"];
  const color = colors[index % colors.length];
  const left = `${(index * 17.3) % 100}%`;
  const delay = `${(index * 0.15) % 1.5}s`;
  const duration = `${2 + (index % 3) * 0.5}s`;
  const size = 6 + (index % 4) * 2;

  return (
    <div
      className="pointer-events-none absolute top-0"
      style={{
        left,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: index % 2 === 0 ? "50%" : "2px",
        animation: `confetti-fall ${duration} ${delay} ease-in forwards`,
        opacity: 0.9,
      }}
    />
  );
}

export function RoundComplete({
  results,
  onPlayAgain,
  onViewLeaderboard,
}: RoundCompleteProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  const totalCorrect = results.filter((r) => r.result?.correct).length;
  const totalPoints = results.reduce(
    (sum, r) => sum + (r.result?.pointsAwarded ?? 0),
    0,
  );
  const isPerfect = totalCorrect === results.length;

  useEffect(() => {
    if (isPerfect) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isPerfect]);

  const [displayPoints, setDisplayPoints] = useState(0);
  useEffect(() => {
    const duration = 1000;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPoints(Math.round(eased * totalPoints));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [totalPoints]);

  return (
    <div className="animate-fade-slide-in relative">
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 -top-8 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <ConfettiPiece key={i} index={i} />
          ))}
        </div>
      )}

      <Card className="border-accent/30 bg-card shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 pt-6">
          <Lightning weight="fill" className="h-12 w-12 text-accent" />
          <h2 className="h2 text-center">Round Complete!</h2>

          {isPerfect && (
            <p className="ui-label text-accent text-center">
              🎉 Perfect Score! All correct!
            </p>
          )}

          {/* Total points */}
          <div className="flex flex-col items-center gap-1">
            <span className="caption text-muted-foreground">Points Earned</span>
            <span className="h1 text-accent">{displayPoints}</span>
          </div>

          {/* Answer summary with times */}
          <div className="w-full space-y-2">
            <span className="ui-label text-muted-foreground">
              {totalCorrect} / {results.length} Correct
            </span>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/30 px-4 py-3"
                >
                  {r.result?.correct ? (
                    <CheckCircle
                      weight="fill"
                      className="mt-0.5 h-5 w-5 shrink-0 text-green-400"
                    />
                  ) : (
                    <XCircle
                      weight="fill"
                      className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                    />
                  )}
                  <span className="caption flex-1 text-foreground/80">
                    {r.questionText}
                  </span>
                  <span className="caption shrink-0 font-mono text-xs text-muted-foreground">
                    {r.result ? `${(r.result.elapsedTimeMs / 1000).toFixed(1)}s` : "—"}
                  </span>
                  <span className="caption shrink-0 text-muted-foreground">
                    +{r.result?.pointsAwarded ?? 0}
                  </span>
                </div>
              ))}
            </div>
            {(() => {
              const correctTimes = results
                .filter((r) => r.result?.correct)
                .map((r) => r.result!.elapsedTimeMs);
              const fastest = correctTimes.length > 0 ? Math.min(...correctTimes) : null;
              return fastest !== null ? (
                <div className="text-center text-sm font-medium text-accent pt-1">
                  ⚡ Fastest correct answer: {(fastest / 1000).toFixed(1)}s
                </div>
              ) : null;
            })()}
          </div>

          {/* Action buttons */}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={onViewLeaderboard} variant="outline" size="lg" className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]">
              <Trophy weight="fill" className="mr-2 h-4 w-4" />
              View Leaderboard
            </Button>
            <Button onClick={onPlayAgain} size="lg" className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]">
              <ArrowClockwise weight="regular" className="mr-2 h-4 w-4" />
              Play Again
            </Button>
          </div>

          <HowScoringWorksDialog />
        </CardContent>
      </Card>
    </div>
  );
}
