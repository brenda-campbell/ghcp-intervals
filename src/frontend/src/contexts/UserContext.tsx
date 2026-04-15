import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createUser, getUser, ApiError, type User } from "@/services/api";

const STORAGE_KEY = "ff_userId";

interface UserContextValue {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const storedId = localStorage.getItem(STORAGE_KEY);

      if (storedId) {
        try {
          const existing = await getUser(storedId);
          setUser(existing);
          return;
        } catch (err) {
          // If 404 or invalid, create a new user instead
          if (err instanceof ApiError && err.status === 404) {
            localStorage.removeItem(STORAGE_KEY);
          } else {
            throw err;
          }
        }
      }

      // No stored user or it was invalid — create a new one
      const newUser = await createUser();
      localStorage.setItem(STORAGE_KEY, newUser.userId);
      setUser(newUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load user";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const refreshed = await getUser(user.userId);
      setUser(refreshed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh user";
      setError(message);
    }
  }, [user]);

  useEffect(() => {
    void initUser();
  }, [initUser]);

  return (
    <UserContext value={{ user, isLoading, error, refreshUser }}>
      {children}
    </UserContext>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
}
