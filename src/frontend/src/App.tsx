import { useState, useRef, useEffect } from "react"
import { Lightning, Trophy, GearSix } from "@phosphor-icons/react"
import { UserBadge } from "@/components/UserBadge"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { useUser } from "@/contexts/UserContext"
import { Skeleton } from "@/components/ui/skeleton"
import { LeaderboardPage } from "@/components/LeaderboardPage"
import { QuestionPage } from "@/components/QuestionPage"
import { AdminPanel } from "@/components/AdminPanel"
import { cn } from "@/lib/utils"

type View = "quiz" | "leaderboard" | "admin"

function App() {
  const { user, isLoading } = useUser()
  const [view, setView] = useState<View>("quiz")
  const quizTabRef = useRef<HTMLButtonElement>(null)
  const leaderboardTabRef = useRef<HTMLButtonElement>(null)
  const adminTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const showAdmin = user?.isAdmin === true

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
            <UserBadge />
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
            {view === "quiz" && <QuestionPage onNavigateToLeaderboard={() => setView("leaderboard")} />}
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
