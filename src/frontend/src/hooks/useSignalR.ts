import { useCallback, useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { apiUrl } from "@/services/api";
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

export interface ScoresResetEvent {
  scope: "all" | "selected";
  usersAffected: number;
  resetBy: string;
  resetAt: string;
  categoryId?: string;
}

export interface PresenceUpdateEvent {
  count: number;
  userId: string;
  displayName: string;
}

export interface RegistrationChangedEvent {
  isOpen: boolean;
}

export interface UseSignalRReturn {
  connection: signalR.HubConnection | null;
  connectionState: ConnectionState;
  leaderboardData: LeaderboardEntry[] | null;
  playerActivity: PlayerActivity | null;
  categoryChanged: CategoryChangedEvent | null;
  quizStarted: boolean | null;
  scoresResetSignal: ScoresResetEvent | null;
  presenceCount: number | null;
  registrationOpen: boolean | null;
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
  const [scoresResetSignal, setScoresResetSignal] = useState<ScoresResetEvent | null>(null);
  const [presenceCount, setPresenceCount] = useState<number | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const mountedRef = useRef(true);

  const startConnection = useCallback(async () => {
    if (connectionRef.current) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(apiUrl("/api"), {
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

    conn.on("scoresReset", (data: ScoresResetEvent) => {
      if (mountedRef.current) setScoresResetSignal(data);
    });

    conn.on("presenceUpdate", (data: PresenceUpdateEvent) => {
      if (mountedRef.current) setPresenceCount(data.count);
    });

    conn.on("registrationChanged", (data: RegistrationChangedEvent) => {
      if (mountedRef.current) setRegistrationOpen(data.isOpen);
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
    scoresResetSignal,
    presenceCount,
    registrationOpen,
  };
}
