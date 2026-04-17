import { useState, useRef, useEffect } from "react"
import { Lightning, Trophy, GearSix, SignOut, Sun, Moon } from "@phosphor-icons/react"
import { UserBadge } from "@/components/UserBadge"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { useUser } from "@/contexts/UserContext"
import { useLogout } from "@/contexts/LogoutContext"
import { useSignalRContext } from "@/contexts/SignalRContext"
import { Skeleton } from "@/components/ui/skeleton"
import { LeaderboardPage } from "@/components/LeaderboardPage"
import { QuestionPage } from "@/components/QuestionPage"
import { AdminPanel } from "@/components/AdminPanel"
import { WaitingScreen } from "@/components/WaitingScreen"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/useTheme"
import { sendHeartbeat, getGameState } from "@/services/api"

type View = "quiz" | "leaderboard" | "admin"

function App() {
  const { user, isLoading } = useUser()
  const logout = useLogout()
  const { isDark, toggle: toggleTheme } = useTheme()
  const { quizStarted: quizStartedSignal, presenceCount } = useSignalRContext()
  const [view, setView] = useState<View>("quiz")
  const [onlineCount, setOnlineCount] = useState(0)
  const [isQuizStarted, setIsQuizStarted] = useState<boolean | null>(null)
  const [activeCategoryName, setActiveCategoryName] = useState<string | null>(null)
  const [timerSeconds, setTimerSeconds] = useState<number>(10)
  const quizTabRef = useRef<HTMLButtonElement>(null)
  const leaderboardTabRef = useRef<HTMLButtonElement>(null)
  const adminTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const showAdmin = user?.isAdmin === true

  // Fetch initial game state to check isStarted
  useEffect(() => {
    let cancelled = false
    getGameState()
      .then((gs) => {
        if (!cancelled) {
          setIsQuizStarted(gs.isStarted ?? false)
          setActiveCategoryName(gs.activeCategoryName ?? null)
          setTimerSeconds(gs.timerSeconds ?? 10)
        }
      })
      .catch(() => { if (!cancelled) setIsQuizStarted(false) })
    return () => { cancelled = true }
  }, [])

  // Keep in sync with SignalR quiz events
  useEffect(() => {
    if (quizStartedSignal !== null) setIsQuizStarted(quizStartedSignal)
  }, [quizStartedSignal])

  // Use SignalR presence updates for immediate online count
  useEffect(() => {
    if (presenceCount !== null) setOnlineCount(presenceCount)
  }, [presenceCount])

  useEffect(() => {
    const refMap: Record<View, React.RefObject<HTMLButtonElement | null>> = {
      quiz: quizTabRef,
      leaderboard: leaderboardTabRef,
      admin: adminTabRef,
    }
    const activeRef = refMap[view]?.current
    if (activeRef) {
      setIndicatorStyle({
        left: activeRef.offsetLeft,
        width: activeRef.offsetWidth,
      })
    }
  }, [view, showAdmin])

  // Send heartbeat every 30 seconds for online presence
  useEffect(() => {
    if (!user) return

    const beat = () => {
      sendHeartbeat(user.userId, user.displayName)
        .then(r => setOnlineCount(r.count))
        .catch(() => {})
    }

    beat()
    const interval = setInterval(beat, 30000)
    return () => clearInterval(interval)
  }, [user])

  return (
    <div className="min-h-[100dvh] p-3 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Lightning weight="fill" className="h-6 w-6 shrink-0 text-accent sm:h-8 sm:w-8" />
            <h1 className="h1 truncate">Fastest Finger</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ConnectionStatus />
            {onlineCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                {onlineCount} online
              </span>
            )}
            <UserBadge />
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <SignOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Navigation tabs with animated sliding indicator */}
        <nav className="relative flex gap-1 rounded-lg border border-border bg-card p-1">
          <div
            className="absolute top-1 bottom-1 rounded-md bg-primary transition-all duration-300 ease-out will-change-[left,width]"
            style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          />
          <button
            ref={quizTabRef}
            onClick={() => setView("quiz")}
            className={cn(
              "relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 sm:px-4",
              view === "quiz"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Lightning weight={view === "quiz" ? "fill" : "regular"} className="size-4" />
            Quiz
          </button>
          <button
            ref={leaderboardTabRef}
            onClick={() => setView("leaderboard")}
            className={cn(
              "relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 sm:px-4",
              view === "leaderboard"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Trophy weight={view === "leaderboard" ? "fill" : "regular"} className="size-4" />
            Leaderboard
          </button>
          {showAdmin && (
            <button
              ref={adminTabRef}
              onClick={() => setView("admin")}
              className={cn(
                "relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 sm:px-4",
                view === "admin"
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GearSix weight={view === "admin" ? "fill" : "regular"} className="size-4" />
              Admin
            </button>
          )}
        </nav>

        {/* View content with page transition */}
        {isLoading ? (
          <div className="animate-skeleton-shimmer space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        ) : (
          <div
            key={view}
            className="animate-page-enter will-change-[opacity,transform]"
          >
            {view === "quiz" && (
              isQuizStarted
                ? <QuestionPage onNavigateToLeaderboard={() => setView("leaderboard")} isQuizStarted={isQuizStarted ?? false} timerSeconds={timerSeconds} />
                : <WaitingScreen categoryName={activeCategoryName} onlineCount={onlineCount} />
            )}
            {view === "leaderboard" && (
              <LeaderboardPage userId={user?.userId} />
            )}
            {view === "admin" && showAdmin && <AdminPanel />}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
