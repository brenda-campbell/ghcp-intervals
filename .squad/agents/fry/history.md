# Project Context

- **Owner:** Brenda Campbell
- **Project:** Fastest Finger Quiz — a competitive quiz game where players answer Azure/GitHub Copilot themed multiple-choice questions. Fastest correct answer wins the round. Points accumulate across sessions. Released via link after each session, 1–3 questions per round.
- **Stack:** Frontend (Azure Static Web App, HTML/JS or React), Backend (Azure Functions HTTP triggers), Database (Cosmos DB), Real-time (SignalR Service), CI/CD (GitHub Actions), IaC (Bicep/ARM)
- **Created:** 2026-04-15

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### fe-scaffold (2026-04-15)
- **Project location:** `src/frontend/` — Vite 8 + React 19 + TypeScript 6
- **Key packages:** `@tailwindcss/vite` (Tailwind v4), `tw-animate-css`, `@phosphor-icons/react`, shadcn/ui (new-york style), `class-variance-authority`, `clsx`, `tailwind-merge`
- **Design system:** Tailwind v4 `@theme` block in `src/index.css` — no `tailwind.config.js`. Colors: primary (#4A90E2), background (#2A2D3A), accent (#C5F542), card (#353849), github-black (#1B1D23)
- **Fonts:** Space Grotesk (sans, headings) + JetBrains Mono (mono, answers/leaderboard) loaded via Google Fonts in `index.html`
- **Typography classes:** `.h1`, `.h2`, `.body-mono`, `.ui-label`, `.leaderboard-text`, `.caption` — defined in `index.css`
- **shadcn/ui components:** Card, Button, Badge, Progress, Separator, Table, Skeleton, Alert in `src/components/ui/`
- **Path alias:** `@/` → `src/` configured in both `tsconfig.app.json` and `vite.config.ts`
- **SWA config:** `staticwebapp.config.json` at repo root with SPA fallback and `/api/*` routing
- **shadcn quirk:** With TS6, `paths` works without `baseUrl` (deprecated). shadcn CLI may create a literal `@/` directory — files need manual move to `src/`.

### fe-question-ui (2026-04-15)
- **QuestionCard** (`src/components/QuestionCard.tsx`): Displays question text (h2 class), category Badge, difficulty Badge (color-coded easy/medium/hard), progress "N / M" indicator. Uses shadcn Card as container. Accepts children for composing AnswerGrid + Timer inside.
- **AnswerGrid** (`src/components/AnswerGrid.tsx`): 2×2 grid (sm:grid-cols-2) → single-column on mobile. Options labeled A–D, JetBrains Mono via `body-mono` class. Selected state: scale 1.03 + primary bg + shadow. Unselected fade to 60% opacity. Disabled after selection prevents double-tap. Min height 56px per PRD.
- **QuestionPage** (`src/components/QuestionPage.tsx`): Orchestrator with loading/playing/feedback/done/error phases. Fetches 3 questions from `/api/questions?count=3` on mount. Tracks elapsed time with 100ms interval. Submits answers via POST `/api/answer` with `userId` from UserContext. Shows inline correct/incorrect feedback + points. Advances through questions, then shows "Round Complete" card with Play Again.
- **API service** (`src/services/api.ts`): Already had `fetchQuestions`, `submitAnswer`, User/Leaderboard types from prior work. Used as-is — no changes needed.
- **App.tsx wiring:** Default view changed from "leaderboard" to "quiz". Quiz placeholder text replaced with `<QuestionPage />`. Mobile padding adjusted to p-4.
- **Build:** Compiles clean (`npm run build` — 0 errors, 0 warnings).

### fe-session (2026-04-15)
- **User identity:** Anonymous — no login. `userId` stored in localStorage under key `ff_userId`. On mount, context checks localStorage → GET to refresh or POST to create.
- **API service:** `src/services/api.ts` — typed client with `createUser()`, `getUser()`, `fetchQuestions()`, `submitAnswer()`. Uses shared `ApiError` class with `.status`.
- **User context:** `src/contexts/UserContext.tsx` — `UserProvider` wraps the app in `main.tsx`. Exposes `{ user, isLoading, error, refreshUser }` via `useUser()` hook.
- **UserBadge:** `src/components/UserBadge.tsx` — shows display name + score in header, skeleton while loading, "Offline" badge on error.
- **TS6 gotcha:** `erasableSyntaxOnly` prevents `public` parameter properties in constructors. Must declare field separately and assign in body.
- **Wiring:** `UserProvider` wraps `<App />` in `main.tsx`. App shows loading skeletons until user is resolved.

### fe-timer (2026-04-15)
- **Timer hook:** `src/hooks/useTimer.ts` — returns `{ elapsedMs, elapsedDisplay, start, stop, reset, isRunning, colorState }`. Uses `performance.now()` + `requestAnimationFrame` for precision timing. `colorState` is `'fast' | 'warning' | 'danger'` based on thresholds (0-5s, 5-10s, 10s+).
- **Timer component:** `src/components/Timer.tsx` — accepts props from hook, renders time in JetBrains Mono (`font-mono`) at `text-5xl`. Shows Phosphor `Clock` icon + shadcn `Progress` bar underneath.
- **Color states:** fast = Electric Lime (#C5F542), warning = amber-400, danger = red-500. All use CSS `transition-all duration-500` for smooth shifts. Glow effects via `drop-shadow`.
- **Animations:** `timer-pulse` (1s loop, scale 1.02x while running), `timer-freeze` (300ms scale+brightness flash on stop). Keyframes in `index.css`.
- **Props-driven design:** Timer component is stateless — parent owns the hook and passes data as props. This keeps Timer reusable and testable.
- **Pre-existing build errors:** `api.ts` (TS1294 erasableSyntaxOnly) and `UserContext.tsx` (TS2305/TS18046) fail `tsc`. Vite build succeeds. Timer code is clean.

### fe-leaderboard (2026-04-15)
- **Leaderboard API:** `getLeaderboard(userId?)` in `src/services/api.ts`. Returns `LeaderboardResponse` with `leaderboard` array + optional `userRank` (when user is outside top 10).
- **RankBadge:** `src/components/RankBadge.tsx` — gold/silver/bronze badges for top 3 using Phosphor Trophy (1st) and Medal (2nd/3rd) icons. Gradient backgrounds. Falls back to `#N` for ranks >3.
- **Leaderboard table:** `src/components/Leaderboard.tsx` — shadcn Table with columns: Rank, Player, Score, Games, Fastest. Current user row highlighted with Electric Lime accent + left border. Alternating row colors via `bg-muted/20`. If user is outside top 10, separator + user row appended below.
- **LeaderboardPage:** `src/components/LeaderboardPage.tsx` — fetches on mount, auto-refreshes every 30s. Skeleton loading (8 rows), error alert with retry button, "last updated" timestamp.
- **Navigation:** Tab bar in `App.tsx` — "Quiz" and "Leaderboard" tabs with icon toggle (fill/regular weight). Tab state managed with `useState<View>`.
- **Fonts:** Space Grotesk for player names (font-sans), JetBrains Mono for scores/numbers (font-mono), matching PRD spec.
- **Fix:** Added `ApiRequestError` export alias for `ApiError` in api.ts — UserContext was importing a name that didn't exist. Build now succeeds cleanly with `tsc -b && vite build`.

### fe-animations (2026-04-15)
- **Page transitions:** `animate-page-enter` (fade+slide-up, 300ms) applied via `key={view}` in App.tsx. Remounts content on tab switch, triggering enter animation.
- **Tab indicator:** Sliding `<div>` with `transition-all duration-300` using `useRef` + `useEffect` to track active tab position. Buttons are `relative z-10` above the indicator.
- **Question transitions:** Horizontal slide-out/slide-in using `animate-question-slide-out` (200ms, translateX -30px) and `animate-question-slide-in` (300ms, translateX 30px). Managed via `transitioning` state + `questionAnimKey` for React remount.
- **Answer stagger:** Each option gets `animate-[option-stagger-in_300ms_ease-out_backwards]` with `animationDelay: i * 75ms` (A→B→C→D). Uses `backwards` fill-mode so transitions still work after animation completes.
- **Leaderboard row enter:** Inline `style.animation` with `row-enter 350ms ease-out ${i*50}ms backwards` for staggered entrance. #1 position gets additional `shimmer-glow 3s 500ms ease-in-out infinite`.
- **Score tick-up:** `AnimatedScore` component in Leaderboard.tsx uses `requestAnimationFrame` + ease-out cubic curve over 800ms. Preserves `prevRef` across re-renders for delta animation on 30s refresh.
- **UserBadge score delta:** Tracks `prevScoreRef` vs `user.totalScore`. Shows floating `+N` with `score-float-up` animation (1.2s) using TrendUp icon. Auto-clears after 1.4s.
- **Micro-interactions:** `hover:scale-[1.03] active:scale-[0.97]` on all action buttons (Retry, Play Again, Next, View Leaderboard). `transition-transform duration-150` for smoothness.
- **Skeleton pulse:** `animate-skeleton-shimmer` (opacity 0.4↔0.7, 1.5s infinite) on loading states.
- **Accessibility:** `@media (prefers-reduced-motion: reduce)` disables all animations/transitions globally.
- **Performance:** `will-change-[opacity,transform]` on animated wrappers. All animations use `transform` + `opacity` only (GPU composited, no layout thrash).
- **CSS-only approach:** Zero new dependencies. All animations are CSS keyframes + transitions. Bundle size unchanged.

### fe-feedback (2026-04-15)
- **AnswerFeedback** (`src/components/FeedbackOverlay.tsx`): Shows CheckCircle (green, drop-shadow glow) for correct, XCircle (red) for incorrect. Displays time taken, animated ScoreDelta points counter, and reveals the correct answer text when wrong. Exported as both `AnswerFeedback` and `FeedbackOverlay`.
- **AnswerGrid enhanced**: Added `correctIndex` and `isCorrect` props. After submission: correct option gets green glow + `animate-glow-correct`, wrong selected gets red + shake + strikethrough via `animate-shake`, non-relevant options fade to 30% opacity.
- **ScoreDelta** (`src/components/ScoreDelta.tsx`): Counting-up animation over 800ms with ease-out cubic curve using `requestAnimationFrame`. Phosphor TrendUp icon + Electric Lime accent color. `animate-score-float` for entrance.
- **RoundComplete** (`src/components/RoundComplete.tsx`): Full summary card — per-question breakdown (CheckCircle/XCircle + question text + points), animated total points counter, "View Leaderboard" + "Play Again" buttons. CSS confetti animation on perfect scores (30 pieces, randomized colors/delays/sizes).
- **QuestionPage refactored**: Tracks `roundResults` array across questions. Auto-advances after 2s (`FEEDBACK_DURATION_MS`) with manual "Next →" skip button. Slide transitions between questions via `animate-fade-slide-in`/`animate-fade-slide-out` with 250ms delay. Added `onNavigateToLeaderboard` prop wired to App.tsx's tab switcher.
- **CSS animations added to `index.css`**: `feedback-shake` (300ms, 3 oscillations), `feedback-glow` (400ms green shadow), `score-float` (600ms bounce-in), `fade-slide-in`/`fade-slide-out` (300/200ms), `confetti-fall` (randomized per piece), `count-pop` (scale pulse).
- **Build:** Clean (`tsc -b && vite build` — 0 errors, 0 warnings).

### fe-mobile (2026-04-15)
- **Viewport:** Added `viewport-fit=cover` to `index.html` meta + `theme-color` meta for notched phones. Body uses `env(safe-area-inset-*)` padding and `min-height: 100dvh`.
- **Overflow prevention:** `overflow-x: hidden` on `html` and `body` in `index.css` — no horizontal scroll on any view.
- **Responsive typography:** `index.css` media query at 640px scales `.h1` → 28px, `.h2` → 22px, `.body-mono` → 16px, `.ui-label` → 14px. Mobile-first approach.
- **App.tsx:** Header uses `min-w-0` + `truncate` on title, `shrink-0` on badge area. Nav tabs use `flex-1` + `min-h-[44px]` for full-width touch targets. Padding tightened to `p-3` on mobile.
- **UserBadge:** `max-w-[180px]` on mobile with `truncate` on display name. Score and icon elements use `shrink-0`.
- **QuestionCard:** Card padding reduced to `p-4` on mobile (→ `sm:p-6` on larger). Same mobile-first approach.
- **AnswerGrid:** `min-h-[48px]` on mobile (→ `sm:min-h-14`), tighter `px-3` mobile padding. Already had single-column mobile layout.
- **QuestionPage:** Timer display centered on mobile with larger text. "Next Question" / "Play Again" buttons are `w-full min-h-[44px]` on mobile.
- **Leaderboard:** Table wrapped in `overflow-x-auto` div. Player name cells use `max-w-[120px]` + `truncate` on mobile. "Games" column hidden < sm, "Fastest" hidden < md (already existed).
- **Timer component:** Progress bar changed from fixed `w-48` to `w-full max-w-48`. Timer font scales `text-4xl sm:text-5xl`.
- **Build:** Compiles clean (`tsc -b && vite build` — 0 errors).

### fe-signalr (2026-04-15)
- **Package:** `@microsoft/signalr` added to dependencies. Connects via `/api` (Azure SWA proxies `/api/negotiate` automatically).
- **Hook:** `src/hooks/useSignalR.ts` — `HubConnectionBuilder` with automatic reconnect `[0, 2s, 5s, 10s, 30s]`. Tracks `connectionState` (connecting/connected/reconnecting/disconnected). Listens for `leaderboardUpdate` and `playerAnswered` events. Cleans up on unmount via `mountedRef` pattern.
- **Context:** `src/contexts/SignalRContext.tsx` — wraps `useSignalR` hook, provides `{ connection, connectionState, leaderboardData, playerActivity }` to all components. Uses React 19 `<Context value={}>` pattern (no `.Provider`).
- **ConnectionStatus:** `src/components/ConnectionStatus.tsx` — green/amber/red dot + label. Pulsing ping animation for connecting/reconnecting states.
- **LeaderboardPage:** Real-time updates via `leaderboardUpdate` event replace polling when connected. Falls back to 30s polling when disconnected. Shows "Live" badge (Broadcast icon) when SignalR is connected.
- **QuestionPage:** Shows "X answering…" counter from `playerAnswered` events with UsersThree icon + pulse animation.
- **App.tsx:** `ConnectionStatus` component added to header next to UserBadge.
- **main.tsx:** `SignalRProvider` wraps `<App />` inside `UserProvider`.
- **Pre-existing fix:** `Leaderboard.tsx` had swapped `TableHeader`/`TableRow` nesting causing 5 TS errors — fixed as part of this work.
- **Build:** Clean `tsc -b && vite build` — 0 errors, 0 warnings.

### blank-screen-fix (2026-04-15)
- **Root cause 1 (crash):** `QuestionResponse` API model was missing `difficulty` field. `QuestionCard.tsx` called `difficulty.toLowerCase()` on `undefined` → TypeError → blank screen.
- **Root cause 2 (answer mismatch):** API `AnswerResult` returned `correctAnswer`/`elapsedTimeMs` but frontend expected `correctIndex`/`timeTaken`. Both sides now return all four fields for full compatibility.
- **Key files:** `src/api/src/models/index.ts` (shared types), `src/api/src/functions/getQuestions.ts` (question mapping), `src/api/src/functions/submitAnswer.ts` (answer result), `src/frontend/src/components/QuestionCard.tsx` (defensive guard), `src/frontend/src/services/api.ts` (frontend types).
- **Pattern:** When API and frontend define the same interface independently, mismatches are silent until runtime. Both sides should be kept in sync or share types.
- **Pre-existing:** `integration-quiz-flow.test.tsx` has a `requestAnimationFrame` infinite loop in its mock — unrelated to this fix.

### fe-email-entry (2026-04-16)
- **EmailEntry** (`src/components/EmailEntry.tsx`): Standalone email + display name login gate component. Props-driven (no direct API calls) — parent passes `onLogin`, `isLoading`, `error`.
- **Validation:** Client-side email regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), display name 2–30 chars. Errors shown on blur (touched state pattern). "Enter the Game" button disabled until both fields valid.
- **Loading state:** SpinnerGap icon with `animate-spin` + "Entering…" text. All inputs disabled during loading.
- **Error handling:** Styled error banner with WarningCircle icon. Detects inactive/deactivated users and shows specific "Contact an admin" message.
- **Styling:** Matches existing card pattern (`border-accent/30 bg-card shadow-lg`), Lightning bolt branding, `animate-fade-slide-in` entrance, centered vertically with `min-h-[100dvh]`. Mobile-friendly with `min-h-[44px]` submit button, `w-full max-w-md` card.
- **Reuses:** shadcn Card, Button; Phosphor icons (Lightning, SpinnerGap, WarningCircle); `cn()` utility; existing typography classes (h2, caption, ui-label).
- **Build:** Clean (`tsc -b && vite build` — 0 errors, 0 warnings).

### fe-auth-gate (2026-04-16)
- **api.ts updates (Task 2F):** Added `loginOrCreate(email, displayName, legacyUserId?)`, `listUsers(adminUserId)`, `toggleUserStatus(targetUserId, isActive, adminUserId)`. Updated `getUser` URL from `/api/user/` to `/api/users/`. Deprecated `createUser` (kept for UserContext compat — remove in Phase 3).
- **AuthGate** (`src/components/AuthGate.tsx`, Task 2E): Wraps app, gates on authentication. On mount checks localStorage for `ff_userId` + `ff_email`. Returning users auto-verified via `loginOrCreate`. Legacy users (userId only, no email) shown EmailEntry with linking flow. New users see EmailEntry for registration.
- **States:** Loading (spinner), deactivated (403 → ShieldSlash card with "sign in as different account" escape hatch), error (retry via page reload), EmailEntry (new/legacy), authenticated (renders children).
- **Props:** `children: ReactNode`, `onUserAuthenticated: (user: User) => void` — callback passes authenticated user to parent for UserProvider integration.
- **localStorage keys:** `ff_userId`, `ff_email`, `ff_displayName` — all three persisted on successful login.
- **Phase 3 notes:** `UserContext.tsx` still imports deprecated `createUser` and uses old `/api/user` endpoint via `getUser`. Test mocks in `edge-cases.test.tsx`, `fixtures.ts`, `integration-user-session.test.tsx` reference `createUser`. All need updating when AuthGate replaces the old flow.
- **Build:** Clean (`tsc -b` — 0 errors).

### fe-auth-wiring-admin (2026-04-16)
- **main.tsx restructured:** `AuthGate` → `UserProvider` → `SignalRProvider` → `App`. A `Root` component holds `userId` state; `AuthGate.onUserAuthenticated` sets it, and `UserProvider` receives it as a prop. Children only render after authentication.
- **UserContext simplified:** Removed auto-create logic (`createUser`, `localStorage` management). Now accepts `userId: string` prop, loads user via `getUser(userId)` on mount. `refreshUser` still available for score updates.
- **UserBadge enhanced:** Shows `ShieldStar` icon (accent color) for admins instead of generic user icon. Admin badge gets `border-accent/40` border highlight. Email shown as tooltip on hover (absolute positioned, 10px text). Score delta animation preserved.
- **AdminPanel** (`src/components/AdminPanel.tsx`): Full user management table — columns: Player (with admin badge), Email, Score, Games, Status toggle. Uses `listUsers(adminUserId)` and `toggleUserStatus()` from api.ts. Self-deactivation prevented (toggle disabled + tooltip for current user row). Loading skeleton, error state with retry, inline error banner for toggle failures. Row stagger animation matches leaderboard pattern.
- **App.tsx:** Added `"admin"` to View union type. Admin tab (GearSix icon) conditionally rendered when `user?.isAdmin === true`. Tab indicator logic updated to support dynamic tab refs via a refMap. `AdminPanel` lazy-renders only for admin view.
- **Tests updated:** `integration-user-session.test.tsx` rewritten for new `UserProvider(userId)` contract — removed createUser/localStorage tests, added load-by-id/error/loading tests. `edge-cases.test.tsx` localStorage test replaced with a UserProvider load test.
- **Build:** Clean (`tsc -b && vite build` — 0 errors, 0 warnings).

### 2026-04-16 — Fixed AuthGate Auto-Login + Delete Button (fry-fix-delete)
- **What:** Resolved race condition in AuthGate where returning users weren't being auto-logged in on first load, and added delete user button to AdminPanel.
- **AuthGate fix:** Fixed `useEffect` dependency array to include `isAuthenticated` state — prevents infinite loops during auto-login. Added fallback for inactive users (403 errors now display: "Your account has been deactivated. Contact an admin to reactivate.").
- **AdminPanel delete:** Added delete button (Trash icon) per user row with confirmation modal showing user's display name. Calls `deleteUser()` endpoint. On success, removes user from table instantly (optimistic update). Shows error toast on failure. Self-deletion prevented.
- **api.ts export:** New `deleteUser(userId, adminUserId)` function wraps `DELETE /api/users/{userId}`.
- **UX improvements:** Confirmation modal for destructive action, instant table refresh, error visibility, self-deletion guard.
- **Verification:** TypeScript clean (`tsc -b`), AuthGate auto-login no longer infinite-loops, build passes (`vite build` — 0 errors).

### fe-admin-categories (2026-04-15)
- **Category API functions** added to `api.ts`: `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `getGameState`, `setActiveCategory`, `getOnlinePlayers`, `sendHeartbeat`. New types: `Category`, `GameState`, `QuestionType`, `OnlinePlayersResponse`.
- **Question.type** field added (optional `QuestionType`) for true-false support.
- **getLeaderboard** updated to accept optional `categoryId` parameter.
- **AdminPanel** restructured: now renders three sections — Online Players (auto-refreshing every 15s), Category Management (CRUD table + active switcher), and User Management (unchanged). Each section loads independently.
- **Category CRUD:** Inline edit mode for name/description/format. Create form toggles with New button. Delete with confirm dialog. Active/inactive toggle per category.
- **Active Category Switcher:** Dropdown of active categories + prominent "Set Active" button with success indicator. Fetches game state on mount.
- **Verification:** TypeScript compiles clean (`npx tsc --noEmit` — 0 errors).

### fe-game-ui-updates (2026-04-16)
- **useSignalR** (`hooks/useSignalR.ts`): Added `categoryChanged` event handler and state. New `CategoryChangedEvent` interface exported. Fires when admin switches active category via SignalR.
- **SignalRContext** auto-exposes `categoryChanged` since it mirrors `UseSignalRReturn`.
- **AnswerGrid** (`components/AnswerGrid.tsx`): Now accepts optional `questionType` prop. When `"true-false"`: uses ✓/✗ labels, 2-col grid always, larger buttons (min-h-[64px]), green/red tinted borders and label badges. Multiple-choice unchanged.
- **QuestionPage** (`components/QuestionPage.tsx`): Listens for `categoryChanged` — reloads questions on category switch. Shows auto-dismissing (3s) category change banner. Passes `questionType` to AnswerGrid.

### fe-score-reset-ui — Admin Score Reset UI (2026-04-16)

**API Integration:**
- **api.ts** updated — Added `resetScores(payload)` async function calling `POST /api/scores/reset` with scope/userIds/categoryId
- **useSignalR** updated — Added `scoresReset` event handler that auto-refreshes user list when admin broadcasts reset

**UI Components:**
- **ScoreResetSection (new):** Placed between CategoryManagement and UserManagement in AdminPanel. Features:
  - "Reset All Scores" button with optional category dropdown for scoped reset
  - Inline confirmation banner (expands in-place, not modal) with user count + confirm/cancel buttons
  - Matches existing AdminPanel patterns (lightweight UX, no page reload)
- **User table (AdminPanel):** Added checkbox column for per-user selection
  - Checkbox header auto-checks/unchecks all visible users
  - "Reset Selected" action button appears conditionally when users are selected
  - Works with ScoreResetSection scope logic
- **AdminPanel** now fetches categories in parallel with users (was users-only before)
- **GameState type** extended with `questionIds: string[]` field to stay in sync with Bender's backend model

**Design Decisions:**
- Inline confirmation over modal — simpler UX, consistent with existing patterns
- Checkbox column in user table rather than separate "select users" UI — keeps mental model clean
- SignalR auto-refresh ensures Admin A's reset is immediately visible to Admin B
- Category scope optional on "Reset All" for isolated leaderboard resets

**Verification:** TypeScript compiles clean, manual smoke tests for all reset flows passed
- **LeaderboardPage** (`components/LeaderboardPage.tsx`): Added category filter dropdown. Fetches active categories on mount. `selectedCategoryId` passed to `getLeaderboard`. Dark-theme styled select element.
- **App.tsx**: Added online presence indicator — sends heartbeat every 30s via `sendHeartbeat`, displays green pulsing dot + count next to ConnectionStatus.
- **Verification:** TypeScript compiles clean (`npx tsc --noEmit` — 0 errors).

### fe-quiz-launch (2026-04-16)
- **Waiting room gate:** Quiz tab now shows `WaitingScreen` component when `isStarted === false`. Fetches `GameState.isStarted` on mount via `getGameState()`, keeps in sync via SignalR `quizStarted`/`quizStopped` events.
- **WaitingScreen** (`components/WaitingScreen.tsx`): Centered pulsing Lightning bolt, "Waiting for quiz to start…" text, shows active category name badge and online player count. Uses existing animate-page-enter + animate-pulse patterns.
- **QuizControlSection** in AdminPanel: New sub-component at top of admin panel. Green "Start Quiz" / red "Stop Quiz" toggle button with LIVE/STOPPED status indicator. Fetches initial state + listens to SignalR events.
- **api.ts:** Added `isStarted: boolean` to `GameState` interface. New `startQuiz(adminUserId)` and `stopQuiz(adminUserId)` functions calling `/api/game/start-quiz` and `/api/game/stop-quiz`.
- **useSignalR.ts:** Added `quizStarted` and `quizStopped` event handlers. New `quizStarted: boolean | null` in return state. New `QuizStartedEvent` / `QuizStoppedEvent` interfaces.
- **App.tsx:** Imports `useSignalRContext` and `getGameState`. On mount fetches game state for `isStarted` + `activeCategoryName`. Quiz tab renders `<WaitingScreen>` when stopped, `<QuestionPage>` when live. Both admin and non-admin see waiting screen; admin uses Admin tab to start quiz.
- **Verification:** TypeScript compiles clean (`npx tsc --noEmit` — 0 errors).

### fe-score-reset (2026-04-16)
- **api.ts:** Added `resetScores(adminUserId, scope, userIds?, categoryId?)` function calling `POST /api/scores/reset`. Added `questionIds?: string[]` to `GameState` interface.
- **useSignalR.ts:** Added `scoresReset` event handler with new `ScoresResetEvent` interface and `scoresResetSignal` state. Auto-exposed via SignalRContext since it mirrors `UseSignalRReturn`.
- **AdminPanel — ScoreResetSection:** New card component with "Reset All Scores" button (red/destructive), optional category scope dropdown, inline confirmation prompt showing user count, loading spinner, success/error feedback with auto-dismiss.
- **AdminPanel — User table checkboxes:** Added checkbox column with Select All header checkbox. "Reset Selected" button appears in card header when ≥1 user selected. Inline confirmation banner with confirm/cancel. Selection state cleared after successful reset.
- **AdminPanel — SignalR integration:** `scoresResetSignal` from context triggers automatic user list refresh, keeping table scores current after any reset (even from another admin).
- **AdminPanel — categories fetch:** `fetchUsers` now parallel-fetches `listCategories` so ScoreResetSection has category data for scope dropdown.
- **Verification:** TypeScript compiles clean (`npx tsc --noEmit` — 0 errors).
