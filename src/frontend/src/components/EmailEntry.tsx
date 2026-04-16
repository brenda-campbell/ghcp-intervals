import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightning, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface EmailEntryProps {
  onLogin: (email: string, displayName: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | null {
  if (!email) return null;
  return EMAIL_REGEX.test(email) ? null : "Please enter a valid email address";
}

function validateDisplayName(name: string): string | null {
  if (!name) return null;
  if (name.length < 2) return "Name must be at least 2 characters";
  if (name.length > 30) return "Name must be 30 characters or fewer";
  return null;
}

export function EmailEntry({ onLogin, isLoading, error }: EmailEntryProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  const emailError = emailTouched ? validateEmail(email) : null;
  const nameError = nameTouched ? validateDisplayName(displayName) : null;

  const isFormValid =
    email.length > 0 &&
    displayName.length >= 2 &&
    displayName.length <= 30 &&
    EMAIL_REGEX.test(email);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isFormValid || isLoading) return;
      onLogin(email.trim(), displayName.trim());
    },
    [email, displayName, isFormValid, isLoading, onLogin],
  );

  const isInactiveError = error?.toLowerCase().includes("deactivated") || error?.toLowerCase().includes("inactive");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-slide-in">
        <Card className="border-accent/30 bg-card shadow-lg">
          <CardContent className="flex flex-col items-center gap-6 pt-6">
            {/* Branding */}
            <Lightning weight="fill" className="h-12 w-12 text-accent" />
            <div className="text-center">
              <h1 className="h2">Fastest Finger</h1>
              <p className="caption mt-1 text-muted-foreground">
                Enter your details to join the game
              </p>
            </div>

            {/* Error display */}
            {error && (
              <div
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border px-4 py-3",
                  isInactiveError
                    ? "border-destructive/40 bg-destructive/10"
                    : "border-destructive/40 bg-destructive/10",
                )}
              >
                <WarningCircle
                  weight="fill"
                  className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                />
                <span className="caption text-destructive">
                  {isInactiveError
                    ? "Your account has been deactivated. Contact an admin."
                    : error}
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
              {/* Email field */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="ui-label text-muted-foreground">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  disabled={isLoading}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  className={cn(
                    "h-10 w-full rounded-md border bg-background/30 px-3 text-sm text-foreground outline-none",
                    "placeholder:text-muted-foreground/50",
                    "transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    emailError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/50"
                      : "border-border",
                  )}
                />
                {emailError && (
                  <span className="caption text-destructive">{emailError}</span>
                )}
              </div>

              {/* Display name field */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="displayName" className="ui-label text-muted-foreground">
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  placeholder="Your game name"
                  value={displayName}
                  disabled={isLoading}
                  maxLength={30}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  className={cn(
                    "h-10 w-full rounded-md border bg-background/30 px-3 text-sm text-foreground outline-none",
                    "placeholder:text-muted-foreground/50",
                    "transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    nameError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/50"
                      : "border-border",
                  )}
                />
                <div className="flex items-center justify-between">
                  {nameError ? (
                    <span className="caption text-destructive">{nameError}</span>
                  ) : (
                    <span />
                  )}
                  <span className="caption text-muted-foreground">
                    {displayName.length}/30
                  </span>
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                size="lg"
                disabled={!isFormValid || isLoading}
                className="mt-2 w-full min-h-[44px] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
              >
                {isLoading ? (
                  <>
                    <SpinnerGap className="h-5 w-5 animate-spin" />
                    Entering…
                  </>
                ) : (
                  <>
                    <Lightning weight="fill" className="h-5 w-5" />
                    Enter the Game
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
