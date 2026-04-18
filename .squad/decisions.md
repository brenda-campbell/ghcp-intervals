# Squad Decisions

## Active Decisions

### ADR-001: Cosmos DB Data Model — Single Database, Multiple Containers

We use a single Cosmos DB database (`fastestfinger`) with two containers:
- **`users`** — partition key `/userId`. Stores player profiles, cumulative scores, session history.
- **`questions`** — partition key `/category`. Stores the question pool with correct answers, categories, and difficulty metadata.

Scores and leaderboard data live on the user document to avoid cross-container queries for ranking. Leaderboard reads are a simple query on the `users` container sorted by `totalScore DESC`.

**Rationale:** Two containers is the simplest model that keeps question management separate from player state. No need for a dedicated leaderboard container — a single query with ORDER BY on a composite index handles it.

---

### ADR-002: SignalR Integration via Azure Functions Bindings

SignalR is consumed through Azure Functions bindings (`SignalRConnectionInfo` input binding and `SignalR` output binding), not a standalone SignalR hub. The frontend connects via the `/api/negotiate` endpoint.

**Rationale:** This avoids running a dedicated SignalR server. Azure Functions + SignalR Service in serverless mode keeps the architecture simple and cost-effective.

---

### ADR-003: Timer Authority — Server-Side Validation

The timer runs visually on the client for responsiveness, but the **server is the authority on elapsed time**. The client sends an answer with its local timestamp; the server records its own receipt timestamp and uses that for scoring. This prevents client-side timer manipulation.

**Rationale:** A competitive game with leaderboards must not trust client timing. Server-authoritative timing is the only approach that prevents cheating.

---

### ADR-004: Static Web App + Azure Functions — Managed Backend

The Azure Static Web App's managed Functions integration is used for the API backend. The Functions app is deployed as part of the SWA resource, not as a standalone Function App.

**Rationale:** Simplifies deployment (single resource), eliminates CORS configuration, and keeps the infrastructure minimal. If we hit scaling limits of managed functions later, we can break out to a standalone Function App — but not until we need it.

---

### ADR-005: CI/CD — Single GitHub Actions Workflow

One workflow (`deploy.yml`) handles:
1. Build frontend (React)
2. Build backend (Azure Functions)
3. Run tests
4. Deploy to Azure Static Web App (which includes the Functions API)
5. Bicep infrastructure deployment as a separate job that runs first

**Rationale:** One workflow is easier to reason about and debug. Separate jobs within the workflow give us parallelism where needed and serial execution where dependencies exist.

---

### ADR-006: Bicep IaC — All Resources in One Template

A single `main.bicep` with modules for:
- Static Web App
- Cosmos DB account + database + containers
- SignalR Service
- Required role assignments and connection strings

**Rationale:** The resource count is small (~4 resources). Modules within a single template give us organization without the overhead of separate deployment stacks.

---

### ADR-007: Question Delivery — Server-Selected, Client-Rendered

Questions are selected server-side (random from pool, no duplicates within a round) and delivered as a JSON payload. The correct answer index is **not** sent to the client — only after submission does the server respond with correctness and the right answer.

**Rationale:** Sending the correct answer to the client would allow cheating via browser DevTools. Server-side answer validation is mandatory for competitive integrity.

---

### ADR-008: Email Uniqueness via Query-Before-Create

Enforce email uniqueness using a query-then-create pattern with `_etag` conflict detection. Partition key remains `/userId` (no change). Cross-partition email queries are acceptable at quiz game scale.

**Rationale:** Changing the partition key would break all existing queries. A separate uniqueness-index document is over-engineering. Simple query-before-create is correct and maintainable.

---

### ADR-009: Replace createUser, Don't Maintain Backward Compat

Old `POST /api/user` and `GET /api/user/{userId}` endpoints are removed. New endpoints:
- `POST /api/users/login-or-create` — query by email, create if missing
- `GET /api/users/{userId}` — fetch user profile
- `GET /api/users` — list all users (admin only)
- `PATCH /api/users/{userId}/status` — update user status (admin only)

The frontend is the only consumer of the old API. No external contract to preserve.

**Rationale:** Clean break is simpler than maintaining two versions. New names clarify intent (login vs. registration).

---

### ADR-010: Admin Gating via x-user-id Header Check

Admin endpoints read the `x-user-id` header to identify the requester. A shared helper `requireAdmin(request, container)` reads the user doc and checks `isAdmin === true`. Returns 401 for missing header, 403 for non-admin or missing user.

**Rationale:** Lightweight access control for a quiz game. No OAuth/tokens needed. Risk of header spoofing accepted — not a production security system.

---

### ADR-011: AuthGate Pattern for Login Flow

New `AuthGate` component wraps the app. Checks localStorage for stored email/userId → calls `login-or-create` → gates rendering. Shows `EmailEntry` if no stored email, blocked screen if user is inactive.

**Rationale:** Clean separation of auth state from app rendering. `UserProvider` no longer auto-creates users; auth state is explicit in the gate.

---

### ADR-012: No Cosmos Migration, Graceful Defaults

Add `email`, `isActive`, `isAdmin` to User interface. Treat missing `isActive` as `true`, missing `isAdmin` as `false`. No schema migration script — Cosmos DB is schemaless and defensive code handles missing fields.

**Rationale:** Cosmos doesn't need migrations. Legacy users keep scores when prompted for email on next visit.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

---

### ADR-013: Quiz Start/Stop via GameState.isStarted

Added `isStarted: boolean` to the singleton `GameState` document (default `false`). Two new admin-only endpoints control quiz launch:
- `POST /api/game/start-quiz` → sets `isStarted = true`, broadcasts `quizStarted`
- `POST /api/game/stop-quiz` → sets `isStarted = false`, broadcasts `quizStopped`

Category changes (`setCategory`) preserve the current `isStarted` value — switching categories mid-quiz doesn't accidentally reset started state.

**Rationale:** Single boolean on existing singleton is simpler than a separate `quizSession` document. Admin has explicit control over timing (auto-start rejected). Preserving isStarted on category switch prevents accidental resets.

---

### ADR-014: Waiting Room Pattern (Frontend)

New `WaitingScreen` component gates the Quiz tab when `GameState.isStarted === false`. Both admin and non-admin players see the waiting room (same UX). Admin controls quiz via `QuizControlSection` in AdminPanel. State synced via initial `getGameState()` fetch + SignalR `quizStarted`/`quizStopped` events.

**Rationale:** Separates concerns — all players wait together, admin has separate control. SignalR events eliminate polling and ensure real-time sync across all connected clients.

---

### ADR-015: Quiz Launch Broadcast

SignalR broadcasts `quizStarted { startedAt, startedBy }` and `quizStopped { stoppedAt, stoppedBy }` events to all connected clients when quiz state changes. Event payloads include metadata for audit and UI context.

**Rationale:** Real-time broadcast is more responsive than polling `getGameState()` every N seconds. Metadata enables future audit logging and user attribution.

---

### ADR-016: Categories and Category Scores in Cosmos DB

Three new containers added:
- `categories` (partition key `/id`) — category metadata
- `categoryScores` (partition key `/categoryId`, composite index on `totalScore DESC, fastestTimeMs ASC`) — per-category leaderboards
- `gameState` (partition key `/id`) — active game session state

**Rationale:** `categoryScores` partitioned by `/categoryId` enables efficient single-partition leaderboard queries. Composite index mirrors global leaderboard pattern for consistency. `categories` and `gameState` use `/id` for simple point-read lookups.

---

### ADR-017: Per-Category Score Tracking and Leaderboard

`submitAnswer` endpoint updates `categoryScoresContainer` after each answer using read-then-write pattern. `leaderboardService.ts` exports `getCategoryLeaderboard(categoryId)` for category-scoped boards. `getLeaderboard` accepts optional `?categoryId=` query param.

**Rationale:** Per-category stats enable future features (category rankings, category-specific achievements). Read-then-write has acceptable race window at current scale; production multi-instance setup would use Cosmos transactions or Redis.

---

### ADR-018: Online Presence via In-Memory Map

`presenceService.ts` maintains a Map-based presence store with 60-second timeout. `GET /api/game/online-players` returns count for non-admin, full list for admins. `POST /api/game/heartbeat` registers/refreshes presence.

**Rationale:** In-memory presence is MVP-grade; per-instance only (not shared across Azure Functions scale-out). Acceptable for current scale; production would migrate to Redis or Cosmos. Heartbeat interval matches existing polling patterns (30s).

---

### ADR-019: Category CRUD Endpoints and Cascade Delete

Six new admin-only endpoints:
- `POST /api/categories` — create category
- `GET /api/categories` — list (admin sees all, non-admin sees only active)
- `PATCH /api/categories/{categoryId}` — update category
- `DELETE /api/categories/{categoryId}` — delete + cascade all questions in category
- `POST /api/game/set-category` — set active category + broadcast
- `GET /api/game/state` — get current GameState

Category names are unique (case-insensitive). Deleting a category cascades all its questions. `setCategory` preserves `isStarted` state.

**Rationale:** Cascade prevents orphaned questions. Case-insensitive uniqueness prevents confusion. Cascade delete is simpler than soft-delete or orphan cleanup.

---

### ADR-020: Admin Category Management UI (Single-File Components)

AdminPanel decomposed into four internal components in one file: `OnlinePlayersSection`, `ActiveCategorySwitcher`, `CategoryManagement`, and orchestrating `AdminPanel` root. Each sub-component independently fetches data (no cascading errors). User Management remains untouched.

**Rationale:** Single-file architecture keeps tightly coupled admin features co-located. Independent loading prevents category errors from blocking user table. Minimal blast radius on existing components.

---

### ADR-021: AuthGate and UserProvider Boundary

AuthGate owns login flow (localStorage, `loginOrCreate` calls, deactivated/error gates, EmailEntry). UserProvider is a pure data provider (takes `userId` as prop, loads user, no auto-create). Root component in main.tsx bridges them.

**Rationale:** Clean separation makes UserProvider testable without mocking localStorage. AuthGate is single source of truth for "is user logged in?"

---

### ADR-022: Question Type Support (Multiple-Choice and True-False)

`Question` model updated: `options` changed from 4-element tuple to `string[]` (supports 2 or 4 options). New `type: QuestionType` field (`"multiple-choice" | "true-false"`). Backward compat: missing `type` defaults to `"multiple-choice"` at mapping time.

**Rationale:** Variable-length options support T/F (2 options) and MC (4 options). Default fallback ensures old questions render as MC. No schema migration needed.

---

### ADR-023: Game UI for True-False Questions

AnswerGrid component conditionally renders labels (✓/✗ vs A/B/C/D), grid layout (2-col vs responsive), and button sizing based on `questionType` prop. Green/red tints applied to borders and badge backgrounds for visual affordance.

**Rationale:** Visual hierarchy differentiates T/F from MC without modal/toast overhead. Matches existing animation patterns.

---

### ADR-024: Category Notification (Non-Intrusive Banner)

Auto-dismissing banner (3s timeout) displays at top of quiz area when category changes (via SignalR `categoryChanged` event). Native `<select>` element for leaderboard category filter (styled with Tailwind, no Radix UI dependency).

**Rationale:** Lightweight notification matches existing patterns. Graceful degradation if backend doesn't broadcast event (notification simply won't appear).

---

### ADR-025: SignalR Upgrade to Standard_S1 and HTTP Concurrency Tuning

SignalR upgraded from Free_F1 (20 connections) to Standard_S1 (1000 connections). Azure Functions HTTP concurrency set to 100 concurrent requests.

**Rationale:** Free tier was hard blocker for 80-user scalability. Standard_S1 supports target concurrent player count.

---

### ADR-026: Question Cache and Leaderboard Throttle for Scale

`submitAnswer` caches questions in-memory (per-instance) and throttles leaderboard broadcast to 1/second. Question cache eliminates redundant cross-partition queries when many users answer same question. Throttle reduces Cosmos reads from N/round to ~1/round.

**Rationale:** Main backend bottlenecks for 80 concurrent players. In-memory cache is MVP-grade per-instance optimization; production would use distributed cache.

---

### ADR-027: Synchronized Questions via GameState.questionIds

Pin question IDs in the GameState singleton when admin starts a quiz. All players receive the exact same questions in the same order.

- `startQuiz` selects N random questions from the active category and stores their IDs in `gameState.questionIds`
- `getQuestions` returns pinned questions (in order) when quiz is started; falls back to random when not
- `stopQuiz` and `setCategory` clear pinned questions

**Rationale:** Without synchronization, different players received different random questions each time `getQuestions` was called, making the quiz unfair. Pinning ensures identical question sequences across all participants once a quiz starts. Cross-partition query to fetch pinned questions by ID is bounded to max 3 IDs (negligible cost). Question order determinism is a feature—all players see identical sequence.

---

### ADR-028: Score Reset API (POST /api/scores/reset)

Admin endpoint with flexible scope for resetting player scores:
- `scope: "all"` — resets every user's scores and deletes all categoryScores docs
- `scope: "selected"` — resets only specified userIds
- Optional `categoryId` parameter narrows reset to a single category's scores (global user scores untouched)
- Broadcasts `scoresReset` SignalR event so frontends refresh leaderboards in real-time

**Rationale:** Admins need flexibility to reset scores—globally (new tournament round), per-user (individual reset), or per-category (isolated leaderboard reset). Sequential Cosmos operations per user are acceptable at quiz game scale. Partial failures on "selected" scope are logged and skipped rather than rolled back—better to reset 9/10 users than 0/10. SignalR broadcast ensures all connected clients see leaderboard updates immediately.

---

### ADR-029: Pre-existing startQuiz Tests Require Mock Updates

`startQuiz.test.ts` was written before Bender's sync questions update, which added a `questionsContainer` import. The old tests do not mock `questionsContainer`, causing 6 of 11 tests to fail with 500 errors.

**Fix:** Update `startQuiz.test.ts` to:
1. Add `questionsContainer` to the cosmosClient mock
2. Provide a mock question pool in `beforeEach` for happy-path tests
3. Add a test case for "returns 400 when no questions available for active category"

The new `syncQuestions.test.ts` already covers question-pinning behavior cross-endpoint, so the old test just needs its mocks fixed—not rewritten.

**Rationale:** Test coverage remains valid; only infrastructure (mocks) needed updating. New tests (resetScores + syncQuestions) verify all behaviors in isolation and integration.

---

### ADR-030: E2E Test Infrastructure Setup

Created Playwright E2E test suite at `src/frontend/e2e/` with 7 tests covering the complete user journey (login, waiting room, leaderboard, admin panel, logout, re-login, return user flow). All tests pass against live site. Screenshots captured at each step (10 total) for visual regression tracking.

**Key Decisions:**
- Tests run against live site (baseURL parameterized for CI in future)
- Screenshots to `e2e/screenshots/` for incident documentation
- Admin tests use `brencampbell@microsoft.com`
- Test user emails timestamped to avoid collisions

**Rationale:** Post-Cosmos-DB-outage verification required repeatable safety net. Screenshots provide visual proof. Provides regression protection for future development.

**Future Consideration:** E2E test user records accumulate in Cosmos—add cleanup script.

---

### ADR-031: Dark/Light Theme State Management

Theme preference is stored in localStorage and applied via `.dark` CSS class on the `<html>` element. CSS uses `:root` for light-mode defaults and `.dark` pseudo-class for overrides. Runtime values injected via CSS custom properties (e.g., `--color-primary`).

- Inline `<script>` in `index.html` reads localStorage before first paint to prevent flash-of-wrong-theme
- Theme toggle via `useTheme` hook (global state)
- Primary (#4A90E2), accent (#C5F542), and destructive (#EF4444) colors consistent across both themes
- All existing components auto-support via semantic Tailwind classes (bg-card, text-foreground, etc.)

**Rationale:** LocalStorage persists user preference across sessions. CSS-first approach keeps theme rendering fast and avoids JavaScript flicker. Semantic Tailwind classes mean component updates are unnecessary.

---

### ADR-032: Admin-Controlled Quiz Rounds (Auto-Stop Without Replay)

When an admin launches a quiz via `startQuiz`:
- All players see the exact same questions in order (via GameState.questionIds pinning)
- Upon quiz completion, players see score summary but no "Play Again" button
- Players await admin to stop quiz and launch next round

Free/practice mode (isQuizStarted=false) retains existing "Play Again" button.

When admin stops quiz via SignalR `quizStopped` event, all clients switch back to WaitingScreen automatically.

**Rationale:** Eliminates unfair replaying during competitive admin-launched rounds. Keeps all players synchronized on round lifecycle. SignalR broadcast ensures real-time state sync across all connected clients.

---

### ADR-033: Configurable Question Count per Round (Range 1–20)

Added `questionCount?: number` to GameState singleton (default 3, range 1–20).

- `startQuiz` resolves count from: request body → GameState stored value → default 3
- New `PATCH /api/game/question-count` (admin-only) persists count and broadcasts `questionCountChanged`
- `setCategory` preserves `questionCount` when switching categories
- `getQuestions.ts` `MAX_QUESTIONS` raised to 20 as hard ceiling for fallback mode
- Validation: rejects start if question pool too small for requested count

Frontend `QuizControlSection` shows dropdown (1–20) when quiz stopped; hidden and labeled when live.

**Rationale:** Admins need per-round customization without code changes. Storing on GameState means config persists across rounds unless explicitly changed. 20-question ceiling prevents accidental DoS from large category queries. Request body override allows per-start tuning without separate API call.

---

### ADR-034: Configurable Per-Question Timer (timerSeconds on GameState)

Added `timerSeconds?: number` to GameState singleton (default 10, range 5-60).

- `startQuiz` resolves timer from: request body → GameState stored value → default 10
- New `PATCH /api/game/timer` (admin-only) persists timer and broadcasts `timerChanged`
- `setCategory` preserves `timerSeconds` when switching categories
- `getGameState` defaults `timerSeconds: 10` in all response paths

**Rationale:** Follows identical pattern to ADR-033 (questionCount). Timer stored on GameState means config persists across rounds. 5-60 range prevents degenerate gameplay (too fast to read / too slow to stay engaged). Included in `quizStarted` broadcast so clients get the value without a separate fetch.

---

### ADR-035: SignalR Presence Broadcast via Heartbeat

Heartbeat endpoint (`POST /api/game/heartbeat`) now includes a SignalR output binding that broadcasts `presenceUpdate { count, userId, displayName }` to all connected clients after registering presence.

Presence timeout reduced from 60s to 45s (one missed heartbeat grace at 30s interval).

**Rationale:** Previously, each client only learned the online count from its own heartbeat response. Now all clients receive real-time count updates via SignalR whenever any player heartbeats. Timeout reduction removes the scenario where a player appears online for 30+ seconds after closing their browser. Per-instance limitation (ADR-018) remains — fixing that requires Redis or Cosmos, which is out of scope for this change.

---

### ADR-036: E2E Test User Cleanup

Playwright E2E tests now track all test user IDs created during the suite and delete them in an `afterAll` hook via `DELETE /api/users/{userId}` using the admin user ID. Cleanup is best-effort — failures are silently ignored to avoid masking real test failures.

**Rationale:** Prevents accumulation of `e2e-test-*@test.com` users in Cosmos DB. Addresses the future consideration noted in ADR-030.

---

### ADR-037: Scoring Metric Fix — gamesPlayed Increments Per-Round

`gamesPlayed` was being incremented on every answer submitted. Changed to increment exactly once per round (admin-started or practice) via:

1. **Removed:** Per-answer increment from `updateUserScore()` in `scoringService.ts` and from category score updates in `submitAnswer.ts`
2. **Added:** New `incrementGamesPlayed(userId)` function exported from `scoringService.ts`
3. **New Endpoint:** `POST /api/game/round-complete` with body `{ userId: string }`
   - Calls `incrementGamesPlayed()` on user document
   - Also increments `gamesPlayed` on active category's categoryScore document
   - Not admin-gated — any player can call
4. **Frontend Action:** Frontend calls endpoint when round phase → `"done"` via fire-and-forget `markRoundComplete(userId)`

**Rationale:** `gamesPlayed` should count completed rounds, not individual answers. Separating this metric from answer submission allows speed scoring to remain accurate regardless of question count. Server-authoritative round completion ensures clients can't artificially inflate the metric.

---

### ADR-038: Speed Scoring Decoupled from Hardcoded Timer

Speed scoring now uses configurable per-round timer instead of hardcoded 10-second timeout:

1. **Changed:** `calculatePoints()` now accepts `timeoutMs` parameter (configurable, no longer hardcoded)
2. **Cache Added:** `submitAnswer` reads `GameState.timerSeconds` via 30s-TTL cache (avoids per-request lookups)
3. **Calculation:** Speed bonus scales proportionally from 5-60s timer range per ADR-034

**Consequences:**
- Speed bonus is now fair across different timer configurations (e.g., 5s quiz vs. 60s quiz)
- No longer pegged to 10s fixed timeout
- Timing verification uses server-side delivery tracker with clientTimestamp fallback (ADR-003 still applies)

**Rationale:** Supports new quiz customization features (ADR-034) without breaking speed scoring math. Decoupling makes scoring mechanics testable independently of timer settings.

---

### ADR-039: Quiz Completion State Persisted in App.tsx

Quiz completion state (boolean flag + results array) moved from `QuestionPage` local state to `App.tsx` to survive tab switches and navigation:

1. **State Holder:** `App.tsx` now owns `quizCompleted: boolean` and `completedResults: QuestionResultEntry[]`
2. **UI Component:** New `QuizCompletedScreen` component renders in App when round completes
3. **Lifecycle:** State resets when `isQuizStarted` → `false` (admin stops quiz via SignalR)
4. **Consequence:** Users can switch to leaderboard tab and back without losing quiz completion UI or triggering accidental restart

**Timing Data:** Per-question response times and fastest correct answer included in round summary.

**Rationale:** Component unmount/remount during tab navigation was causing accidental quiz restart. Lifting state to App boundary ensures persistence across child component lifecycle. This is essential for multiplayer scenarios where players navigate during active competitive rounds.

---

### ADR-040: Fire-and-Forget Round-Complete API Call

Frontend calls `POST /api/game/round-complete` endpoint without blocking UI or error handling via new `markRoundComplete(userId)` function:

1. **Trigger:** Called in `useEffect` when `phase` transitions to `"done"` in `QuestionPage`
2. **Pattern:** `.catch(() => {})` — silently swallows all errors
3. **Scope:** Applies to both admin-started and practice-mode rounds
4. **Deployment Gap:** If backend endpoint not yet deployed, 404 is silently ignored (graceful degradation)

**Rationale:** Round completion metrics are secondary to user experience. Non-blocking pattern ensures UI never stalls on network latency or backend outages. Graceful degradation allows frontend and backend to deploy independently.

---

### ADR-041: Relative Speed-Based Scoring

**Author:** Bender (Backend Dev)  
**Date:** 2026-04-17  
**Status:** Implemented

The old scoring formula `200 × (1 - elapsed/timer)` gave nearly identical scores regardless of speed. Replaced with **relative speed-based scoring**:

```
If correct: score = round(200 × (fastestCorrectMs ÷ playerResponseMs))
Score capped between 1 and 200
If incorrect: 0
```

The fastest correct answer per question gets exactly 200 points. Everyone else gets proportionally less based on how much slower they were.

**Implementation:**
- New `fastestAnswerTracker.ts` service tracks per-question fastest correct time in-memory
- `submitAnswer.ts` uses relative formula instead of timer-based
- `stopQuiz.ts` resets the tracker when a round ends
- Timer cache removed from `submitAnswer.ts` — no longer needed for scoring

**Trade-off:** The first correct answer always gets 200, even if a later answer is technically faster. Since questions are synchronized (ADR-027), this is unlikely and the minor unfairness is accepted for simplicity.

**Test Results:** 152 tests pass (was 145). 3 old scoring tests rewritten + 7 new tracker tests added.

**Rationale:** Provides fair differentiation based on actual response speed. Simplifies scoring logic and works well with synchronized question delivery (ADR-027).

---

### ADR-042: Backend Observability & Resilience Patterns

**Author:** Bender (Backend Dev)  
**Date:** 2026-04-17  
**Status:** Implemented

Backend API endpoints hardened with structured logging, request correlation IDs, retry logic, and circuit breaker patterns for improved diagnostics and fault tolerance.

**Structured Logging (`src/api/src/services/logger.ts`):**
- JSON-structured log entries with `event`, `functionName`, `correlationId`, `durationMs`, error details
- Uses Azure Functions managed backend `context.log`/`context.error` (no external library)
- Sensitive data (email addresses) masked in logs (domain only)

**Request Correlation via `x-correlation-id` Header:**
- Every request gets a correlation ID (from request header or auto-generated UUID)
- Returned in response headers so frontend can include it in error reports
- All log entries for that request share the same correlation ID

**Cosmos Retry (`src/api/src/services/resilience.ts`):**
- `withRetry()`: 3 attempts, exponential backoff (200ms base)
- Retries 429, 503, transient network errors
- Does NOT retry client errors (400/401/403/404)
- Applied to all Cosmos calls in `loginOrCreate.ts` and `getGameState.ts`

**Circuit Breaker Pattern:**
- `withResilience()`: Trips after 5 consecutive failures, 30-second cooldown
- `loginOrCreate`: Returns 503 "temporarily unavailable" when circuit is open
- `getGameState`: Returns sensible defaults when circuit is open
- In-memory state — resets on cold start (acceptable for SWA managed functions)

**Health Check Endpoint (`GET /api/health`):**
- Probes Cosmos DB connectivity
- Returns 200/healthy or 503/unhealthy
- Used by monitoring or frontend for proactive health detection

**Trade-offs:**
- Resilience state (circuit breaker, retry) is in-memory per instance. Acceptable for SWA managed functions scale.
- No external APM (App Insights SDK) added — can be layered on later if needed.

**Test Results:** 155 tests passing (all green).

**Rationale:** Recurring API errors with opaque diagnostics required systematic approach. Correlation IDs enable end-to-end tracing. Retry logic handles transient Cosmos failures. Circuit breaker prevents cascading failures. In-memory state acceptable at MVP scale.

---

### ADR-043: Client-Side Logging & Self-Healing UI Pattern

**Author:** Fry (Frontend Dev)  
**Date:** 2026-04-17  
**Status:** Implemented

Frontend hardened with client-side logging, error recovery, and health monitoring to prevent invisible failures and improve user experience during network issues.

**Console-Based Structured Logging (`src/frontend/src/services/logger.ts`):**
- All client errors, events, and API calls logged as JSON to console
- Not an external service — keeps bundle lightweight
- Transport-agnostic design enables future App Insights upgrade by only changing `logger.ts`

**Rate-Limited Error Dedup:**
- Repeated errors within 2s are suppressed to avoid console flooding during reconnection storms

**Instrumented Fetch Wrapper (`src/frontend/src/services/api.ts`):**
- All API calls go through a single timing+logging wrapper
- Less invasive than instrumenting each function individually
- Logs request/response with correlation ID and duration
- Reads `x-correlation-id` from response headers for log correlation with backend

**Health-Check Polling in ConnectionStatus:**
- Uses `/api/health` endpoint (from ADR-042) with adaptive polling
- 30s when healthy, 5s when disconnected
- Coexists with existing SignalR dot indicator

**Auto-Retry in AuthGate:**
- 3 automatic retries with 10s countdown before falling back to manual retry
- Prevents transient errors from permanently blocking users

**Team Impact:**
- **Bender:** Frontend depends on `GET /api/health` returning 200 when API is up. Reads `x-correlation-id` response header on error responses.
- **Everyone:** Console logs are structured JSON — upgrading to App Insights later only requires changing `logger.ts` transport.

**Build Status:** Build clean. 0 errors, 0 warnings.

**Rationale:** Users were hitting API errors and seeing blank/stuck screens. After ADR-042 fixed backend diagnostics, needed client-side resilience to prevent invisible failures. Auto-retry + health polling provide defense-in-depth recovery.

---

### ADR-044: GitHub Copilot Dev Days Visual Rebrand

**Author:** Fry (Frontend Dev)  
**Date:** 2026-04-17  
**Status:** Implemented

Quiz app rebranded from generic "Fastest Finger Quiz" identity to GitHub Copilot Dev Days event-specific look, matching Manchester event on April 24, 2026.

**Color Palette (GitHub Dark Theme):**
- **Primary:** `#3FB950` (GitHub green) — replaces `#4A90E2` (blue)
- **Accent:** `#7EE787` (soft mint green) — replaces `#C5F542` (Electric Lime)
- **Background:** `#0D1117` (GitHub dark) — replaces `#2A2D3A`
- **Destructive:** `#F85149` (GitHub red) — replaces `#EF4444`

**Visual Changes:**
- Brand icon changed from Phosphor `Lightning` to `GithubLogo` on login screen
- Header retains `Lightning` icon as quiz-specific symbol
- Event-specific elements added to login: date/location badge ("April 24, 2026 • Manchester"), gradient background, glowing icon effect
- All gameplay UI (timers, badges, leaderboard accents) automatically inherits new mint green accent — no per-component changes needed
- Light theme also updated to GitHub's light palette for consistency

**Consequences:**
- The event badge date is hardcoded — future events need text update
- `GithubLogo` requires ESM import from `@phosphor-icons/react` v2.1.10 (not CJS compatible)

**Rationale:** Event-specific branding increases engagement for Manchester Dev Days. Reusing GitHub's palette creates visual coherence with Copilot platform. Semantic Tailwind classes mean new colors propagate automatically without per-component changes.

---
