import { useCallback, useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import type { LeaderboardEntry } from "@/services/api";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface PlayerActivity {
  playerCount: number;
  questionId: string;
  timestamp: string;
}

export interface CategoryChangedEvent {
  categoryId: string;
  categoryName: string;
  questionFormat: string;
}

export interface QuizStartedEvent {
  startedAt: string;
  startedBy: string;
}

export interface QuizStoppedEvent {
  stoppedAt: string;
  stoppedBy: string;
}

export interface UseSignalRReturn {
  connection: signalR.HubConnection | null;
  connectionState: ConnectionState;
  leaderboardData: LeaderboardEntry[] | null;
  playerActivity: PlayerActivity | null;
  categoryChanged: CategoryChangedEvent | null;
  quizStarted: boolean | null;
}

export function useSignalR(): UseSignalRReturn {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [leaderboardData, setLeaderboardData] = useState<
    LeaderboardEntry[] | null
  >(null);
  const [playerActivity, setPlayerActivity] = useState<PlayerActivity | null>(
    null,
  );
  const [categoryChanged, setCategoryChanged] = useState<CategoryChangedEvent | null>(null);
  const [quizStarted, setQuizStarted] = useState<boolean | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const mountedRef = useRef(true);

  const startConnection = useCallback(async () => {
    if (connectionRef.current) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl("/api", {
        // Azure SignalR serverless mode — negotiate at /api/negotiate
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = conn;

    conn.onreconnecting(() => {
      if (mountedRef.current) setConnectionState("reconnecting");
    });

    conn.onreconnected(() => {
      if (mountedRef.current) setConnectionState("connected");
    });

    conn.onclose(() => {
      if (mountedRef.current) setConnectionState("disconnected");
    });

    // Register event handlers
    conn.on("leaderboardUpdate", (data: LeaderboardEntry[]) => {
      if (mountedRef.current) setLeaderboardData(data);
    });

    conn.on("playerAnswered", (data: PlayerActivity) => {
      if (mountedRef.current) setPlayerActivity(data);
    });

    conn.on("categoryChanged", (data: CategoryChangedEvent) => {
      if (mountedRef.current) setCategoryChanged(data);
    });

    conn.on("quizStarted", (_data: QuizStartedEvent) => {
      if (mountedRef.current) setQuizStarted(true);
    });

    conn.on("quizStopped", (_data: QuizStoppedEvent) => {
      if (mountedRef.current) setQuizStarted(false);
    });

    try {
      setConnectionState("connecting");
      await conn.start();
      if (mountedRef.current) setConnectionState("connected");
    } catch {
      if (mountedRef.current) setConnectionState("disconnected");
      connectionRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void startConnection();

    return () => {
      mountedRef.current = false;
      const conn = connectionRef.current;
      if (conn) {
        void conn.stop();
        connectionRef.current = null;
      }
    };
  }, [startConnection]);

  return {
    connection: connectionRef.current,
    connectionState,
    leaderboardData,
    playerActivity,
    categoryChanged,
    quizStarted,
  };
}
