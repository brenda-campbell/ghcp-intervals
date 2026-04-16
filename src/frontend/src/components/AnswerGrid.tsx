import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuestionType } from "@/services/api";

const MC_LABELS = ["A", "B", "C", "D"] as const;
const TF_LABELS = ["✓", "✗"] as const;

interface AnswerGridProps {
  options: string[];
  selectedIndex: number | null;
  disabled: boolean;
  onSelect: (index: number) => void;
  /** Set after submission to reveal correct answer styling */
  correctIndex?: number | null;
  /** Whether the user's selected answer was correct */
  isCorrect?: boolean | null;
  questionType?: QuestionType;
}

export function AnswerGrid({
  options,
  selectedIndex,
  disabled,
  onSelect,
  correctIndex = null,
  isCorrect = null,
  questionType = "multiple-choice",
}: AnswerGridProps) {
  const hasResult = correctIndex !== null && isCorrect !== null;
  const isTrueFalse = questionType === "true-false";
  const labels = isTrueFalse ? TF_LABELS : MC_LABELS;
  const gridCols = isTrueFalse ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={cn("grid gap-4", gridCols)}>
      {options.map((option, i) => {
        const isSelected = selectedIndex === i;
        const hasSelection = selectedIndex !== null;
        const isCorrectOption = hasResult && i === correctIndex;
        const isWrongSelected = hasResult && isSelected && !isCorrect;

        // Subtle tint for T/F buttons in default (pre-selection) state
        const tfDefaultTint =
          isTrueFalse && !hasResult && !hasSelection
            ? i === 0
              ? "border-green-500/30 hover:border-green-500/50"
              : "border-red-500/30 hover:border-red-500/50"
            : "";

        return (
          <Button
            key={i}
            variant="outline"
            disabled={disabled}
            onClick={() => onSelect(i)}
            style={{ animationDelay: `${i * 75}ms` }}
            className={cn(
              "h-auto cursor-pointer justify-start px-3 py-3 text-left",
              "body-mono whitespace-normal",
              "animate-[option-stagger-in_300ms_ease-out_backwards]",
              "transition-all duration-150",
              isTrueFalse ? "min-h-[64px] sm:min-h-[72px]" : "min-h-[48px] sm:min-h-14 sm:px-4",

              // T/F default tint
              tfDefaultTint,

              // Pre-result: selected state
              !hasResult && isSelected &&
                "scale-[1.03] border-primary bg-primary text-primary-foreground shadow-md",
              !hasResult && hasSelection && !isSelected && "opacity-60",
              !hasResult && !hasSelection && "hover:scale-[1.02] hover:shadow-md active:scale-[0.97]",

              // Post-result: correct answer glow
              isCorrectOption &&
                "animate-glow-correct border-green-500 bg-green-500/20 text-white shadow-[0_0_12px_rgba(34,197,94,0.4)]",

              // Post-result: wrong selected shake + red
              isWrongSelected &&
                "animate-shake border-destructive bg-destructive/20 text-destructive line-through",

              // Post-result: fade out non-relevant options
              hasResult && !isCorrectOption && !isWrongSelected && "opacity-30",
            )}
          >
            <span
              className={cn(
                "ui-label mr-3 shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150",
                isTrueFalse && "text-base",
                isCorrectOption
                  ? "bg-green-500/30 text-green-300"
                  : isWrongSelected
                    ? "bg-destructive/30 text-destructive"
                    : isSelected
                      ? "bg-white/20 text-primary-foreground"
                      : isTrueFalse && i === 0
                        ? "bg-green-500/15 text-green-400"
                        : isTrueFalse && i === 1
                          ? "bg-red-500/15 text-red-400"
                          : "bg-muted text-muted-foreground",
              )}
            >
              {labels[i]}
            </span>
            <span className="flex-1">{option}</span>
          </Button>
        );
      })}
    </div>
  );
}
