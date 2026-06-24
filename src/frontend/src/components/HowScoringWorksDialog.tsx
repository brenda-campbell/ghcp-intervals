import { useState } from "react";
import { Info } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export function HowScoringWorksDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Info className="size-4" aria-hidden="true" />
        How scoring works
      </Button>

      <DialogContent aria-labelledby="scoring-title" aria-describedby="scoring-desc">
        <DialogHeader>
          <DialogTitle id="scoring-title">How scoring works</DialogTitle>
          <DialogDescription id="scoring-desc">
            Points are awarded based on how quickly you answer correctly.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4 text-sm text-foreground">
          <ul className="space-y-2" role="list">
            <li className="flex gap-2">
              <span className="mt-0.5 text-accent" aria-hidden="true">✓</span>
              <span>A correct answer can earn up to <strong>200 points</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-accent" aria-hidden="true">⚡</span>
              <span>The <strong>fastest correct answer</strong> receives the full 200 points.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-muted-foreground" aria-hidden="true">⏱</span>
              <span>Slower correct answers receive <strong>proportionally fewer points</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-destructive" aria-hidden="true">✗</span>
              <span>Incorrect answers and timeouts receive <strong>zero points</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-muted-foreground" aria-hidden="true">≈</span>
              <span>Ties are resolved using <strong>cumulative response time</strong> — the faster overall player wins.</span>
            </li>
          </ul>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="mb-1 font-semibold text-foreground">Example</p>
            <p className="text-muted-foreground">
              If the fastest correct answer is <strong>1.5 seconds</strong> (200 pts) and you answer
              in <strong>3 seconds</strong>, you receive{" "}
              <strong>100 points</strong>{" "}
              <span className="text-xs">(1.5 ÷ 3 × 200)</span>.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Got it
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
