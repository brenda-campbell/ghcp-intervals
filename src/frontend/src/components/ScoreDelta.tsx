import { useEffect, useState } from "react";
import { TrendUp } from "@phosphor-icons/react";

interface ScoreDeltaProps {
  points: number;
  className?: string;
}

export function ScoreDelta({ points, className = "" }: ScoreDeltaProps) {
  const [displayPoints, setDisplayPoints] = useState(0);

  useEffect(() => {
    if (points <= 0) return;

    const duration = 800;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPoints(Math.round(eased * points));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [points]);

  if (points <= 0) return null;

  return (
    <div
      className={`animate-score-float flex items-center gap-2 ${className}`}
    >
      <TrendUp weight="regular" className="h-5 w-5 text-accent" />
      <span className="ui-label text-accent animate-count-pop">
        +{displayPoints}
      </span>
      <span className="caption text-muted-foreground">pts</span>
    </div>
  );
}
