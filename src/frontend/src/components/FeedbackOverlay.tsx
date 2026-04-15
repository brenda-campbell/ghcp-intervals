import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { ScoreDelta } from "@/components/ScoreDelta";
import type { AnswerResult } from "@/services/api";

interface AnswerFeedbackProps {
  result: AnswerResult;
  correctAnswerText?: string;
}

export function AnswerFeedback({ result, correctAnswerText }: AnswerFeedbackProps) {
  const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  return (
    <div className="animate-fade-slide-in mt-4 flex flex-col items-center gap-3">
      {result.correct ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle
              weight="fill"
              className="h-8 w-8 text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]"
            />
            <span className="ui-label text-green-400">Correct!</span>
          </div>
          <span className="caption text-muted-foreground">
            {formatTime(result.timeTaken)}
          </span>
          <ScoreDelta points={result.pointsAwarded} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <XCircle
              weight="fill"
              className="h-8 w-8 text-destructive"
            />
            <span className="ui-label text-destructive">Incorrect</span>
          </div>
          {correctAnswerText && (
            <p className="caption text-muted-foreground text-center">
              Correct answer: <span className="text-green-400">{correctAnswerText}</span>
            </p>
          )}
          <span className="caption text-muted-foreground">
            {formatTime(result.timeTaken)} · +{result.pointsAwarded} pts
          </span>
        </div>
      )}
    </div>
  );
}

export { AnswerFeedback as FeedbackOverlay };
