import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LABELS = ["A", "B", "C", "D"] as const;

interface AnswerGridProps {
  options: string[];
  selectedIndex: number | null;
  disabled: boolean;
  onSelect: (index: number) => void;
  /** Set after submission to reveal correct answer styling */
  correctIndex?: number | null;
  /** Whether the user's selected answer was correct */
  isCorrect?: boolean | null;
}

export function AnswerGrid({
  options,
  selectedIndex,
  disabled,
  onSelect,
  correctIndex = null,
  isCorrect = null,
}: AnswerGridProps) {
  const hasResult = correctIndex !== null && isCorrect !== null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {options.map((option, i) => {
        const isSelected = selectedIndex === i;
        const hasSelection = selectedIndex !== null;
        const isCorrectOption = hasResult && i === correctIndex;
        const isWrongSelected = hasResult && isSelected && !isCorrect;

        return (
          <Button
            key={i}
            variant="outline"
            disabled={disabled}
            onClick={() => onSelect(i)}
            style={{ animationDelay: `${i * 75}ms` }}
            className={cn(
              "h-auto min-h-[48px] cursor-pointer justify-start px-3 py-3 text-left sm:min-h-14 sm:px-4",
              "body-mono whitespace-normal",
              "animate-[option-stagger-in_300ms_ease-out_backwards]",
              "transition-all duration-150",

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
                isCorrectOption
                  ? "bg-green-500/30 text-green-300"
                  : isWrongSelected
                    ? "bg-destructive/30 text-destructive"
                    : isSelected
                      ? "bg-white/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
              )}
            >
              {LABELS[i]}
            </span>
            <span className="flex-1">{option}</span>
          </Button>
        );
      })}
    </div>
  );
}
