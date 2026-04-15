import { Trophy, Medal } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const rankConfig = {
  1: {
    label: "1st",
    icon: Trophy,
    bg: "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10",
    text: "text-yellow-400",
    border: "border-yellow-500/40",
    iconColor: "#FFD700",
  },
  2: {
    label: "2nd",
    icon: Medal,
    bg: "bg-gradient-to-r from-gray-300/15 to-gray-400/5",
    text: "text-gray-300",
    border: "border-gray-400/30",
    iconColor: "#C0C0C0",
  },
  3: {
    label: "3rd",
    icon: Medal,
    bg: "bg-gradient-to-r from-orange-600/15 to-orange-700/5",
    text: "text-orange-400",
    border: "border-orange-500/30",
    iconColor: "#CD7F32",
  },
} as const;

interface RankBadgeProps {
  rank: number;
  className?: string;
}

export function RankBadge({ rank, className }: RankBadgeProps) {
  const config = rankConfig[rank as keyof typeof rankConfig];

  if (!config) {
    return (
      <span className={cn("font-mono text-sm text-muted-foreground", className)}>
        #{rank}
      </span>
    );
  }

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.bg,
        config.text,
        config.border,
        className,
      )}
    >
      <Icon weight="fill" className="size-4" style={{ color: config.iconColor }} />
      {config.label}
    </span>
  );
}
