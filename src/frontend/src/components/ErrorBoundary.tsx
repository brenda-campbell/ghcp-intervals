import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { logError } from "@/services/logger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowClockwise, Warning } from "@phosphor-icons/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
  correlationId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null, correlationId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || "An unexpected error occurred",
      correlationId: null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const correlationId = crypto.randomUUID?.() ?? Date.now().toString(36);
    this.setState({ correlationId });
    logError("ErrorBoundary", error, {
      correlationId,
      componentStack: info.componentStack ?? "",
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-slide-in">
            <Card className="border-destructive/30 bg-card shadow-lg">
              <CardContent className="flex flex-col items-center gap-5 pt-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
                  <Warning weight="fill" className="h-8 w-8 text-destructive" />
                </div>

                <h2 className="h2">Something went wrong</h2>
                <p className="caption text-muted-foreground max-w-xs">
                  The app hit an unexpected error. Reloading usually fixes it.
                </p>

                <Button
                  onClick={this.handleReload}
                  className="min-h-[44px] bg-primary text-primary-foreground transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
                >
                  <ArrowClockwise className="mr-2 h-5 w-5" />
                  Reload
                </Button>

                {/* Report section */}
                <div className="w-full rounded-lg border border-border/40 bg-background/30 p-3 text-left">
                  <p className="ui-label text-muted-foreground mb-1">Error details</p>
                  <p className="text-xs text-destructive/80 break-words">
                    {this.state.errorMessage}
                  </p>
                  {this.state.correlationId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ID: <code className="font-mono text-[10px]">{this.state.correlationId}</code>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
