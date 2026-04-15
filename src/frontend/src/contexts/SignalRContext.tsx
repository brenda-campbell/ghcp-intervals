import { createContext, useContext, type ReactNode } from "react";
import { useSignalR, type UseSignalRReturn } from "@/hooks/useSignalR";

const SignalRContext = createContext<UseSignalRReturn | undefined>(undefined);

export function SignalRProvider({ children }: { children: ReactNode }) {
  const signalR = useSignalR();

  return (
    <SignalRContext value={signalR}>
      {children}
    </SignalRContext>
  );
}

export function useSignalRContext(): UseSignalRReturn {
  const ctx = useContext(SignalRContext);
  if (!ctx) {
    throw new Error("useSignalRContext must be used within a SignalRProvider");
  }
  return ctx;
}
