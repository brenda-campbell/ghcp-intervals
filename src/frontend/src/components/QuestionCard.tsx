import type { ReactNode } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface QuestionCardProps {
  questionText: string;
  category: string;
  difficulty: string;
  questionNumber: number;
  totalQuestions: number;
  children?: ReactNode;
}

const difficultyColor: Record<string, string> = {
  easy: "bg-green-600/80 text-white",
  medium: "bg-amber-500/80 text-white",
  hard: "bg-destructive/80 text-white",
};

export function QuestionCard({
  questionText,
  category,
  difficulty,
  questionNumber,
  totalQuestions,
  children,
}: QuestionCardProps) {
  const diffClass =
    difficultyColor[difficulty?.toLowerCase()] ?? "bg-secondary text-secondary-foreground";

  return (
    <Card className="border-border/50 bg-card shadow-lg">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{category}</Badge>
          <Badge className={diffClass}>{difficulty}</Badge>
          <span className="ui-label ml-auto text-muted-foreground">
            {questionNumber} / {totalQuestions}
          </span>
        </div>
        <h2 className="h2 mt-2">{questionText}</h2>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
    </Card>
  );
}
