import { useCallback, useEffect, useState } from "react";
import { EmailEntry } from "@/components/EmailEntry";
import { loginOrCreate, ApiError, type User } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldSlash, SpinnerGap, ArrowClockwise } from "@phosphor-icons/react";

const KEY_USER_ID = "ff_userId";
const KEY_EMAIL = "ff_email";
const KEY_DISPLAY_NAME = "ff_displayName";

interface AuthGateProps {
  children: React.ReactNode;
  onUserAuthenticated: (user: User) => void;
}

export function AuthGate({ children, onUserAuthenticated }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLegacy, setIsLegacy] = useState(false);
  const [isDeactivated, setIsDeactivated] = useState(false);

  // Persist user to localStorage and notify parent
  const completeLogin = useCallback(
    (authenticatedUser: User) => {
      localStorage.setItem(KEY_USER_ID, authenticatedUser.userId);
      localStorage.setItem(KEY_EMAIL, authenticatedUser.email ?? "");
      localStorage.setItem(
        KEY_DISPLAY_NAME,
        authenticatedUser.displayName ?? "",
      );
      setUser(authenticatedUser);
      setError(null);
      setIsDeactivated(false);
      onUserAuthenticated(authenticatedUser);
    },
    [onUserAuthenticated],
  );

  // On mount: check localStorage and attempt auto-login
  useEffect(() => {
    const storedUserId = localStorage.getItem(KEY_USER_ID);
    const storedEmail = localStorage.getItem(KEY_EMAIL);

    if (storedEmail && storedUserId) {
      // Returning user — verify via loginOrCreate
      const storedDisplayName = localStorage.getItem(KEY_DISPLAY_NAME);
      setIsLoading(true);
      loginOrCreate(storedEmail, storedDisplayName || "")
        .then((u) => {
          completeLogin(u);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 403) {
            setIsDeactivated(true);
          } else {
            setError(
              err instanceof Error ? err.message : "Failed to verify account",
            );
          }
        })
        .finally(() => setIsLoading(false));
    } else if (storedUserId && !storedEmail) {
      // Legacy user — has userId but no email
      setIsLegacy(true);
      setIsLoading(false);
    } else {
      // New user — no stored data
      setIsLoading(false);
    }
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle EmailEntry login submission
  const handleLogin = useCallback(
    async (email: string, displayName: string) => {
      setError(null);
      const legacyUserId = isLegacy
        ? (localStorage.getItem(KEY_USER_ID) ?? undefined)
        : undefined;

      try {
        const u = await loginOrCreate(email, displayName, legacyUserId);
        completeLogin(u);
        setIsLegacy(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          throw new Error(
            "Your account has been deactivated. Contact an admin.",
          );
        }
        throw err;
      }
    },
    [isLegacy, completeLogin],
  );

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-fade-slide-in">
          <SpinnerGap className="h-10 w-10 text-accent animate-spin" />
          <p className="caption text-muted-foreground">Verifying account…</p>
        </div>
      </div>
    );
  }

  // --- Deactivated state ---
  if (isDeactivated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-slide-in">
          <Card className="border-destructive/30 bg-card shadow-lg">
            <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
              <ShieldSlash weight="fill" className="h-12 w-12 text-destructive" />
              <h2 className="h2 text-destructive">Account Deactivated</h2>
              <p className="caption text-muted-foreground">
                Your account has been deactivated by an administrator. Please
                contact an admin if you believe this is an error.
              </p>
              <Button
                variant="outline"
                className="mt-2 min-h-[44px] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
                onClick={() => {
                  localStorage.removeItem(KEY_USER_ID);
                  localStorage.removeItem(KEY_EMAIL);
                  localStorage.removeItem(KEY_DISPLAY_NAME);
                  setIsDeactivated(false);
                  setUser(null);
                }}
              >
                Sign in with a different account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- Error state with retry ---
  if (error && !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-slide-in">
          <Card className="border-destructive/30 bg-card shadow-lg">
            <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
              <p className="caption text-destructive">{error}</p>
              <Button
                variant="outline"
                className="min-h-[44px] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
                onClick={() => {
                  setError(null);
                  window.location.reload();
                }}
              >
                <ArrowClockwise className="h-5 w-5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- EmailEntry for new or legacy users ---
  if (!user) {
    return (
      <EmailEntry
        onLogin={handleLogin}
        isLoading={false}
        error={error}
      />
    );
  }

  // --- Authenticated — render children ---
  return <>{children}</>;
}
