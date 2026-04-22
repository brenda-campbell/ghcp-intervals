import { useState, useRef, useEffect } from "react"
import { Lightning, Trophy, GearSix, SignOut, Sun, Moon, Clock, UsersThree } from "@phosphor-icons/react"
import { UserBadge } from "@/components/UserBadge"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { useUser } from "@/contexts/UserContext"
import { useLogout } from "@/contexts/LogoutContext"
import { useSignalRContext } from "@/contexts/SignalRContext"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LeaderboardPage } from "@/components/LeaderboardPage"
import { QuestionPage, type QuestionResultEntry } from "@/components/QuestionPage"
import { AdminPanel } from "@/components/AdminPanel"
import { WaitingScreen } from "@/components/WaitingScreen"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/useTheme"
import { sendHeartbeat, getGameState } from "@/services/api"

type View = "quiz" | "leaderboard" | "admin"

function QuizCompletedScreen({ results, onNavigateToLeaderboard }: { results: QuestionResultEntry[]; onNavigateToLeaderboard: () => void }) {
  const totalCorrect = results.filter((r) => r.result?.correct).length
  const totalPoints = results.reduce((sum, r) => sum + (r.result?.pointsAwarded ?? 0), 0)
  const correctTimes = results.filter((r) => r.result?.correct).map((r) => r.result!.elapsedTimeMs)
  const fastestTime = correctTimes.length > 0 ? Math.min(...correctTimes) : null

  return (
    <div className="animate-fade-slide-in">
      <Card className="border-accent/30 bg-card shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 pt-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="h2 text-center">Quiz Complete!</h2>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Waiting for the next round…
          </p>

          <div className="flex flex-col items-center gap-1">
            <span className="caption text-muted-foreground">Points Earned</span>
            <span className="h1 text-accent">{totalPoints}</span>
            <span className="ui-label text-muted-foreground">
              {totalCorrect} / {results.length} Correct
            </span>
          </div>

          <div className="w-full space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-4 py-2 text-sm">
                <span className={r.result?.correct ? "text-green-400" : "text-red-400"}>
                  {r.result?.correct ? "✓" : "✗"} Q{i + 1}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.result ? `${(r.result.elapsedTimeMs / 1000).toFixed(1)}s` : "—"}
                </span>
                <span className="font-mono text-accent">
                  {r.result?.pointsAwarded ?? 0} pts
                </span>
              </div>
            ))}
          </div>

          {fastestTime !== null && (
            <div className="text-sm font-medium text-accent">
              ⚡ Fastest correct answer: {(fastestTime / 1000).toFixed(1)}s
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock weight="regular" className="h-4 w-4 animate-pulse" />
            <span>Waiting for admin to start next round</span>
          </div>

          <Button
            onClick={onNavigateToLeaderboard}
            variant="outline"
            size="lg"
            className="transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
          >
            <UsersThree weight="fill" className="mr-2 h-4 w-4" />
            View Leaderboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function App() {
  const { user, isLoading } = useUser()
  const logout = useLogout()
  const { isDark, toggle: toggleTheme } = useTheme()
  const { quizStarted: quizStartedSignal, presenceCount, categoryChanged } = useSignalRContext()
  const [view, setView] = useState<View>("quiz")
  const [onlineCount, setOnlineCount] = useState(0)
  const [isQuizStarted, setIsQuizStarted] = useState<boolean | null>(null)
  const [activeCategoryName, setActiveCategoryName] = useState<string | null>(null)
  const [timerSeconds, setTimerSeconds] = useState<number>(10)
  const quizTabRef = useRef<HTMLButtonElement>(null)
  const leaderboardTabRef = useRef<HTMLButtonElement>(null)
  const adminTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [completedResults, setCompletedResults] = useState<QuestionResultEntry[]>([])

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

  // Reset completed state when admin stops/restarts the quiz
  useEffect(() => {
    if (isQuizStarted === false) {
      setQuizCompleted(false)
      setCompletedResults([])
    }
  }, [isQuizStarted])

  // Update category name in real-time when admin switches category
  useEffect(() => {
    if (categoryChanged) {
      setActiveCategoryName(categoryChanged.categoryName ?? null)
    }
  }, [categoryChanged])

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
            <h1 className="h1 truncate">Dev Days Quiz</h1>
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
            disabled={isQuizStarted === true && !quizCompleted}
            onClick={() => setView("leaderboard")}
            className={cn(
              "relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 sm:px-4",
              isQuizStarted && !quizCompleted
                ? "pointer-events-none opacity-40"
                : view === "leaderboard"
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
                ? quizCompleted
                  ? <QuizCompletedScreen results={completedResults} onNavigateToLeaderboard={() => setView("leaderboard")} />
                  : <QuestionPage
                      onNavigateToLeaderboard={() => setView("leaderboard")}
                      isQuizStarted={isQuizStarted ?? false}
                      timerSeconds={timerSeconds}
                      onQuizComplete={(results) => {
                        setQuizCompleted(true)
                        setCompletedResults(results)
                      }}
                    />
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
