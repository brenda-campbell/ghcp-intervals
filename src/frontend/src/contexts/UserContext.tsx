import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getUser, type User } from "@/services/api";

interface UserContextValue {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  userId: string;
}

export function UserProvider({ children, userId }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getUser(userId);
      setUser(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load user";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const refreshUser = useCallback(async () => {
    if (!userId) return;
    try {
      const refreshed = await getUser(userId);
      setUser(refreshed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh user";
      setError(message);
    }
  }, [userId]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

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
