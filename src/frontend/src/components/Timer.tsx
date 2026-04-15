import { Clock } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import type { TimerColorState } from "@/hooks/useTimer"

/** Max seconds shown on the progress bar */
const PROGRESS_MAX_S = 15

const colorConfig: Record<
  TimerColorState,
  { text: string; glow: string; progress: string; iconColor: string }
> = {
  fast: {
    text: "text-[#C5F542]",
    glow: "drop-shadow-[0_0_12px_rgba(197,245,66,0.5)]",
    progress: "[&_[data-slot=progress-indicator]]:bg-[#C5F542]",
    iconColor: "text-[#C5F542]",
  },
  warning: {
    text: "text-amber-400",
    glow: "drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]",
    progress: "[&_[data-slot=progress-indicator]]:bg-amber-400",
    iconColor: "text-amber-400",
  },
  danger: {
    text: "text-red-500",
    glow: "drop-shadow-[0_0_14px_rgba(239,68,68,0.6)]",
    progress: "[&_[data-slot=progress-indicator]]:bg-red-500",
    iconColor: "text-red-500",
  },
}

interface TimerProps {
  elapsedMs: number
  elapsedDisplay: string
  isRunning: boolean
  colorState: TimerColorState
  className?: string
}

export function Timer({
  elapsedMs,
  elapsedDisplay,
  isRunning,
  colorState,
  className,
}: TimerProps) {
  const colors = colorConfig[colorState]
  const progressValue = Math.min((elapsedMs / 1000 / PROGRESS_MAX_S) * 100, 100)

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {/* Timer display */}
      <div className="flex items-center gap-2">
        <Clock
          size={24}
          weight="regular"
          className={cn(
            "transition-colors duration-500",
            colors.iconColor,
            isRunning && "animate-[spin_8s_linear_infinite]"
          )}
        />
        <span
          className={cn(
            "font-mono text-4xl font-bold tabular-nums tracking-tight sm:text-5xl",
            "transition-all duration-500",
            colors.text,
            colors.glow,
            isRunning && "animate-[timer-pulse_1s_ease-in-out_infinite]",
            !isRunning && elapsedMs > 0 && "animate-[timer-freeze_300ms_ease-out]"
          )}
        >
          {elapsedDisplay}
        </span>
      </div>

      {/* Progress bar */}
      <Progress
        value={progressValue}
        className={cn(
          "h-1.5 w-full max-w-48 bg-muted/40 transition-all duration-300",
          colors.progress
        )}
      />
    </div>
  )
}

