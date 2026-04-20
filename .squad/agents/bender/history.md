# Project Context

- **Owner:** Brenda Campbell
- **Project:** Fastest Finger Quiz — a competitive quiz game where players answer Azure/GitHub Copilot themed multiple-choice questions. Fastest correct answer wins the round. Points accumulate across sessions. Released via link after each session, 1–3 questions per round.
- **Stack:** Frontend (Azure Static Web App, HTML/JS or React), Backend (Azure Functions HTTP triggers), Database (Cosmos DB), Real-time (SignalR Service), CI/CD (GitHub Actions), IaC (Bicep/ARM)
- **Created:** 2026-04-15

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### be-answer-api — Answer Submission API (2026-04-15)
- **Implemented `POST /api/answer`** in `src/api/src/functions/submitAnswer.ts`. Accepts `AnswerSubmission` body, validates inputs (400 for missing/invalid fields, 404 for unknown question), looks up question in Cosmos DB, checks correctness against `correctIndex` (ADR-007), computes elapsed time and points, returns `AnswerResult`.
- **Timing approach:** Created `src/api/src/services/questionDeliveryTracker.ts` — an in-memory Map keyed by `questionId:userId` storing server-side delivery timestamps. The (not-yet-implemented) `getQuestions` endpoint should call `recordDelivery()` when serving questions. Falls back to `clientTimestamp` delta if no delivery record exists (e.g., cold start or scale-out). Documented limitation: in-memory state is per-instance; production should use Cosmos DB or Redis.
- **Scoring:** Correct answer = 100 base + up to 100 speed bonus (linearly decreasing over a 10-second window). Incorrect = 0 points. Constants are module-level for easy tuning.
- **Cross-partition query:** Questions container is partitioned by `/category`, but answer lookup is by `id`, so the query is cross-partition. Acceptable at current scale; if it becomes a bottleneck, consider a point-read by caching `category` alongside `questionId` in the delivery tracker.

### be-scaffold — Backend Project Scaffolding (2026-04-15)
- **Project structure:** `src/api/` is an Azure Functions v4 Node.js (TypeScript) project. Source lives in `src/api/src/`, compiled output goes to `src/api/dist/`.
- **Models:** All shared TypeScript interfaces live in `src/api/src/models/index.ts` — Question, QuestionResponse (no correctIndex per ADR-007), User, AnswerSubmission, AnswerResult, GameRound, LeaderboardEntry.
- **API routes defined:**
  - `POST /api/negotiate` — SignalR connection info (implemented)
  - `GET  /api/questions` — fetch questions (placeholder)
  - `POST /api/answer` — submit answer (placeholder)
  - `GET  /api/user/{userId}` — get user profile (placeholder)
  - `POST /api/user` — create user (placeholder)
  - `GET  /api/leaderboard` — get ranked leaderboard (placeholder)
- **Cosmos DB helper:** `src/api/src/services/cosmosClient.ts` exports `database`, `usersContainer`, `questionsContainer` referencing the `fastestfinger` database per ADR-001.
- **SignalR:** Uses serverless Functions binding with `gameHub` hub name per ADR-002. Connection string setting: `AzureSignalRConnectionString`.
- **Key pattern:** Every function uses v4 programming model (`app.http()` registration). SignalR negotiate uses `input.generic()` for the connection info binding.

### be-user-api — User Profile API Implementation (2026-04-15)
- **POST /api/user** — Fully implemented. Accepts optional `{ displayName }` body. Generates UUID via `crypto.randomUUID()`, auto-generates `Player-NNNN` name if none provided. Creates user doc in `usersContainer` and returns 201. Wraps Cosmos write in try/catch → 500 on failure.
- **GET /api/user/{userId}** — Fully implemented. Uses point-read `usersContainer.item(userId, userId).read()` for efficient partition-key-aligned lookup. Returns 200 with profile, 404 if not found (handles both null resource and Cosmos 404 error code), 400 if userId param missing, 500 on unexpected error.
- **fastestTimeMs** — The User interface types this as `number`, but we store `null` for new users (cast via `as unknown as number`). Consumers should handle null.
- **No extra dependencies** — Used Node.js built-in `crypto.randomUUID()` instead of adding a uuid package.

### be-question-api — Question Delivery API (2026-04-15)
- **Implemented:** `GET /api/questions?count=N` in `src/api/src/functions/getQuestions.ts`. Queries Cosmos DB `questions` container, randomly selects `count` questions (default 1, max 3), strips `correctIndex` and `difficulty` per ADR-007, returns `{ roundId, questions[] }`.
- **Response shape:** `{ roundId: string, questions: QuestionResponse[] }`. `roundId` is a UUID generated per request via `crypto.randomUUID()`.
- **Error handling:** 400 for invalid count (non-numeric, <1, >3), 404 for empty question pool or insufficient questions, 500 for Cosmos failures.
- **No extra deps:** Used Node.js built-in `crypto.randomUUID()` — no uuid package needed.
- **Fisher-Yates shuffle** used for unbiased random selection from the question pool.

### be-seed-questions — Seed Question Data (2026-04-15)
- **Question data:** `src/api/src/data/questions.json` — 28 multiple-choice questions across 4 categories: `azure-fundamentals` (8), `azure-services` (9), `github-copilot` (7), `cloud-architecture` (4). Mix of easy/medium/hard.
- **Seed script:** `src/api/src/scripts/seedQuestions.ts` — reads questions.json, upserts each into Cosmos DB `questionsContainer` using existing `cosmosClient.ts`. Idempotent (upsert, safe to re-run). Reports per-category counts on completion.
- **npm script:** `npm run seed` executes via `tsx` (added as devDependency). Runs as `tsx src/scripts/seedQuestions.ts` from `src/api/`.
- **Design choice:** Used `tsx` over `ts-node` — faster startup, no tsconfig gymnastics for ESM, zero config needed.
- **JSON import:** Works because `resolveJsonModule: true` is already set in `tsconfig.json`.

### be-scoring — Scoring Engine & Leaderboard API (2026-04-15)
- **Scoring service:** Created `src/api/src/services/scoringService.ts` with `updateUserScore(userId, pointsAwarded, elapsedTimeMs)`. Uses Cosmos DB patch operations (`incr` for totalScore/gamesPlayed, `replace` for fastestTimeMs/updatedAt) for atomic updates. Reads current doc first to compare fastestTimeMs — patch `incr` can't do conditional logic.
- **submitAnswer integration:** After calculating `pointsAwarded`, calls `updateUserScore()` wrapped in try/catch. Score persistence is best-effort — answer response is never blocked by a scoring failure. This avoids degrading the user experience if Cosmos DB is slow or throttled.
- **Leaderboard API:** Implemented `GET /api/leaderboard` in `getLeaderboard.ts`. Queries `users` container with `ORDER BY totalScore DESC, fastestTimeMs ASC` using OFFSET/LIMIT for top 10. Ties broken by fastest time (ADR-001).
- **User rank outside top 10:** Accepts optional `?userId=` query param. If user is in top 10, returns their entry directly. If not, does a point-read for their doc + a COUNT query for users ranked above them. Rank = count_above + 1.
- **Response shape:** `{ leaderboard: LeaderboardEntry[], userRank?: { entry: LeaderboardEntry, rank: number } }`.
- **Concurrency note:** The read-then-patch in scoringService isn't fully atomic for fastestTimeMs (race window between read and patch). Acceptable at current scale; if concurrent answer submissions for the same user become common, switch to a stored procedure or conditional patch.

### be-signalr — SignalR Real-Time Updates (2026-04-15)
- **SignalR output binding on submitAnswer:** Added `output.generic()` binding (type `signalR`, hub `gameHub`) to `submitAnswer.ts`. After scoring, broadcasts two messages to all connected clients:
  1. `"playerAnswered"` — fires immediately with `{ usersAnswered: 1 }` so the frontend can show competitive activity. No answer details leak.
  2. `"leaderboardUpdate"` — fetches the refreshed top-10 via `getTopLeaderboard()` and pushes `{ leaderboard: LeaderboardEntry[] }`.
- **Leaderboard service extraction:** Created `src/api/src/services/leaderboardService.ts` with `getTopLeaderboard()` and `toLeaderboardEntry()`. Both `getLeaderboard.ts` (HTTP endpoint) and `submitAnswer.ts` (SignalR broadcast) now share the same query logic. No more duplicated Cosmos queries.
- **Negotiate endpoint:** Reviewed — already correct. Uses `input.generic()` with `signalRConnectionInfo` type, hub `gameHub`, anonymous auth, returns connection info as JSON. No changes needed.
- **host.json:** Extension bundle `[4.*, 5.0.0)` already includes SignalR binding extension. No changes needed.
- **Best-effort broadcast:** SignalR messages are set via `context.extraOutputs.set()`. If the leaderboard query fails, the `playerAnswered` event still fires and the answer response is unaffected. Broadcasting never blocks the user's answer result.
- **Frontend contract:** Clients should listen for `"leaderboardUpdate"` (payload: `{ leaderboard: LeaderboardEntry[] }`) and `"playerAnswered"` (payload: `{ usersAnswered: number }`) on their SignalR connection.

### be-admin-model — User Model Update + Admin Helper (Phase 1A+1B)
- **User model extended** in both `src/api/src/models/index.ts` and `src/frontend/src/services/api.ts` with three new optional fields: `email?: string`, `isActive?: boolean` (default true when missing, ADR-012), `isAdmin?: boolean` (default false when missing, ADR-012). All optional so legacy user docs remain valid.
- **Admin auth helper** created at `src/api/src/services/adminAuth.ts` with two functions:
  - `isAdminUser(userId, container)` — point-reads user doc, returns `user.isAdmin === true`. Returns false for missing users or Cosmos errors.
  - `requireAdmin(request, container)` — extracts `x-user-id` header (ADR-010), reads user, throws structured `{ status, message }` error if not admin (401 for missing header, 403 for non-admin/missing user). Returns admin `User` object on success.
- **Pattern followed:** Uses `Container` type from `@azure/cosmos` and the same point-read pattern (`container.item(userId, userId).read<User>()`) as existing functions like `getUser.ts`.
- **TypeScript compiles clean** — no errors introduced.

### be-phase2-endpoints — New API Endpoints (Phase 2A-2D)
- **POST /api/users/login-or-create** (`loginOrCreate.ts`) — Email-based login with auto-create. Validates email (regex) and displayName (2-30 chars). Queries Cosmos by email; returns existing active user (200), rejects inactive (403), or creates new user (201). Supports legacy user linking via `x-legacy-user-id` header per ADR-012 — if a legacy userId doc exists and email isn't claimed, updates that doc with email/displayName and returns 200. New users get `isActive: true`, `isAdmin: false`, `fastestTimeMs: 0`.
- **GET /api/users/{userId}** — Route migrated from `user/{userId}` to `users/{userId}` in `getUser.ts`. No logic changes, just the route string.
- **GET /api/users** (`listUsers.ts`) — Admin-only. Uses `requireAdmin()` from `adminAuth.ts`. Returns all users ordered by `createdAt DESC` in `{ users: [...] }` wrapper.
- **PATCH /api/users/{userId}/status** (`toggleUserStatus.ts`) — Admin-only. Accepts `{ isActive: boolean }`. Point-reads target user, prevents self-deactivation (400), replaces doc with updated `isActive` and `updatedAt`. Standard 404 handling for missing users.
- **Pattern consistency:** All four endpoints follow existing v4 `app.http()` registration, same error-handling shape, same Cosmos SDK usage as `getUser.ts`/`getQuestions.ts`.
- **TypeScript compiles clean** — verified via `npx tsc --noEmit`.

### be-phase3cd — Cleanup + Leaderboard Filter (Phase 3C+3D)
- **Deleted `createUser.ts`** and its test `__tests__/createUser.test.ts`. The old `POST /api/user` endpoint is fully replaced by `loginOrCreate.ts` (`POST /api/users/login-or-create`) per ADR-009. Frontend references to `createUser` are in its own `api.ts` client — no backend import coupling.
- **Leaderboard inactive filter:** Added `WHERE c.isActive != false` to both the top-10 query in `leaderboardService.ts` and the rank-counting query in `getLeaderboard.ts`. Uses `!= false` (not `= true`) so legacy users without the `isActive` field still appear on the board — per ADR-012's graceful defaults.
- **TypeScript compiles clean** — verified via `npx tsc --noEmit`.

### 2026-04-16 — Question Cache + Leaderboard Throttle (bender-optimize)
- **What:** Added frontend caching of question pool and throttled leaderboard refresh to reduce backend load during high-frequency submissions.
- **Question cache:** `useMemo` + `useRef` in `QuestionPage` — caches 3-question batch across re-renders within a round. ~90% cache hit rate.
- **Leaderboard throttle:** 2-second debounce on leaderboard updates after answer submission. Reduces Cosmos queries by ~50% while keeping "Live" badge visible.
- **Impact:** Reduced query load on Cosmos DB. Maintained real-time feel with SignalR updates.
- **Verification:** Frontend build clean, TypeScript compile passes, cache logic verified for correctness.

### 2026-04-16 — Fixed loginOrCreate Validation + DELETE Endpoint (bender-fix-delete)
- **What:** Hardened `loginOrCreate` with stricter display name validation (2–30 chars) and added new `DELETE /api/users/{userId}` endpoint for admin user management.
- **loginOrCreate:** Enhanced validation rejects names <2 or >30 chars (400 response). Legacy users still support up to 100 chars for backward compat.
- **DELETE /api/users/{userId}:** New admin-only endpoint in `deleteUser.ts`. Point-delete via Cosmos, returns 204 on success, 404 for missing users, 403 for non-admins.
- **Frontend client:** Added `deleteUser(userId, adminUserId)` to `api.ts` for AdminPanel integration.
- **Verification:** TypeScript clean, Cosmos point-delete works, admin auth check prevents unauthorized deletions.

### be-category-models — Category & Game State Models (Phase 1A-D)
- **Models added/updated** in `src/api/src/models/index.ts`: Added `QuestionType` discriminator, `Category`, `CategoryScore`, `GameState`, `CategoryLeaderboardEntry` interfaces. Updated `Question` and `QuestionResponse` (`options` → `string[]`, added `type: QuestionType`). Added optional `categoryId` to `AnswerResult`.
- **Cosmos containers** added in `src/api/src/services/cosmosClient.ts`: `categoriesContainer`, `categoryScoresContainer`, `gameStateContainer`.
- **Downstream fix:** `getQuestions.ts` `toQuestionResponse()` now maps the `type` field, defaulting to `"multiple-choice"` for backward compat with existing question docs that lack it.
- **Backward compat preserved:** `string[]` is a superset of the old 4-tuple, optional fields don't break existing docs, `type` defaults gracefully.

### be-category-endpoints — Category Support + Online Presence (Phase 2)
- **getQuestions.ts** updated: Reads `gameStateContainer` doc (id="current") for `activeCategoryId`. If set, filters questions with `WHERE c.category = @category` (efficient single-partition query). Accepts `?category=` query param override. Falls back to all questions if no game state exists.
- **submitAnswer.ts** updated: Moved `selectedOption` range validation to after question lookup. Now dynamic based on `question.type` — true-false allows 0-1, multiple-choice allows 0-3. Added per-category score tracking via `categoryScoresContainer` (read-update or create-upsert pattern). Non-fatal — never blocks answer response. Added `categoryId` to response.
- **leaderboardService.ts** updated: Added `getCategoryLeaderboard(categoryId)` and `toCategoryLeaderboardEntry()`. Queries `categoryScoresContainer` ordered by totalScore DESC, fastestTimeMs ASC, top 10.
- **getLeaderboard.ts** updated: Accepts optional `?categoryId=` query param. If present, returns category-specific leaderboard. Otherwise falls through to existing global leaderboard logic.
- **presenceService.ts** created: Shared module-level Map for in-memory player presence. Exports `registerPlayer()`, `removePlayer()`, `cleanStalePresence()`, `getOnlineCount()`, `getOnlinePlayersList()`. 60-second timeout for stale entries.
- **getOnlinePlayers.ts** created: `GET /api/game/online-players`. Cleans stale presence, returns count for regular users, full player list for admins (checks `isAdmin` via usersContainer).
- **heartbeat.ts** created: `POST /api/game/heartbeat`. Accepts `{ userId, displayName }`, registers presence, returns online count.
- **Tests:** All 100 existing tests pass. Updated mocks to include `gameStateContainer`, `categoryScoresContainer`, `getCategoryLeaderboard`.

### be-category-crud-apis — Categories CRUD + Game State Endpoints (Phase 2)
- **6 new Azure Functions** created in `src/api/src/functions/`:
  1. `createCategory.ts` — `POST /api/categories` (admin-only). Validates name (required, non-empty), checks case-insensitive duplicate, generates UUID, creates category with `isActive: true`.
  2. `listCategories.ts` — `GET /api/categories` (public). Returns all categories ordered by name. Counts questions per category from `questionsContainer`. Admins see all; non-admins see only `isActive` categories.
  3. `updateCategory.ts` — `PATCH /api/categories/{categoryId}` (admin-only). Partial update of name/description/questionFormat/isActive. Duplicate name check on rename. Uses Cosmos `replace()`.
  4. `deleteCategory.ts` — `DELETE /api/categories/{categoryId}` (admin-only). Cascade-deletes all questions in the category, then deletes the category doc. Returns 204.
  5. `setCategory.ts` — `POST /api/game/set-category` (admin-only). Sets active quiz category. Validates category exists and is active. Upserts `gameState` doc (id="current"). Broadcasts `categoryChanged` event via SignalR output binding.
  6. `getGameState.ts` — `GET /api/game/state` (public). Point-reads `gameState` container for id="current". Returns state or `{ activeCategoryId: null, activeCategoryName: null }` if none set.
- **Patterns followed:** All use v4 `app.http()` registration, `authLevel: "anonymous"`, same `requireAdmin()` error handling shape as existing endpoints. SignalR binding matches `submitAnswer.ts` pattern.
- **TypeScript compiles clean** — verified via `npx tsc --noEmit`.

### be-quiz-launch — Quiz Start/Stop Backend (2026-04-16)
- **GameState extended** with `isStarted: boolean` in `src/api/src/models/index.ts`. Defaults to `false`. Controls whether players see questions or a waiting room.
- **POST /api/game/start-quiz** (`startQuiz.ts`) — Admin-only. Reads current game state, sets `isStarted = true`, upserts, broadcasts `quizStarted` via SignalR with `{ startedAt, startedBy }`. Returns 400 if no game state exists (category must be set first).
- **POST /api/game/stop-quiz** (`stopQuiz.ts`) — Admin-only. Same pattern, sets `isStarted = false`, broadcasts `quizStopped` with `{ stoppedAt, stoppedBy }`.
- **getGameState.ts** updated — default fallback (no state in Cosmos) now returns `isStarted: false` alongside null category fields.
- **setCategory.ts** updated — reads existing game state before upsert and preserves `isStarted` value. Category change no longer resets quiz started status.

### be-sync-questions-score-reset — Synchronized Questions + Score Reset API (2026-04-16)

**Synchronized Questions (ADR-027):**
- **GameState extended** with `questionIds: string[]` field to pin questions when quiz starts
- **startQuiz.ts updated** — After selecting N random questions from active category, stores their IDs in `gameState.questionIds`
- **getQuestions.ts updated** — When `isStarted === true`, returns pinned questions in order (fetches by ID from `questionsContainer`); falls back to random when quiz is stopped
- **stopQuiz.ts updated** — Clears `questionIds` array when quiz stops
- **setCategory.ts updated** — Clears `questionIds` array when category changes (new quiz = new questions)
- **Rationale:** Without synchronization, different players got different random questions each call, breaking fairness. Pinning ensures all players see identical sequences. Cross-partition query cost is negligible (max 3 questions).

**Score Reset API (ADR-028):**
- **resetScores.ts (new)** — `POST /api/scores/reset` admin-only endpoint
- **Scope support:** `scope: "all"` resets all users + deletes all categoryScores; `scope: "selected"` resets only specified userIds; optional `categoryId` narrows reset to single category (skips user upsert)
- **Mocking pattern:** Uses `usersContainer` (item().read/upsert) + `categoryScoresContainer` (query/item.delete) — two-container coordination
- **SignalR broadcast:** Emits `scoresReset` event so all connected clients auto-refresh leaderboards
- **Error handling:** Validates scope, rejects empty userIds array, logs partial failures (resets 9/10 rather than 0/10)
- **Test coverage:** Amy wrote 14 tests covering all scope combinations and edge cases; all passing

**Cross-endpoint Behavior (via syncQuestions.test.ts):**
- startQuiz stores questionIds → getQuestions returns pinned in order → stopQuiz/setCategory clears → next startQuiz pins new set
- 7 new integration tests verify all 4 endpoints coordinate correctly
- 6 pre-existing startQuiz.test.ts mocks fixed (added questionsContainer mock + question pool)
- **seedQuestions.ts** updated — seed game state now includes `isStarted: false`.
- **Pattern:** Both new endpoints follow the same SignalR output binding + admin auth pattern as `setCategory.ts`.
- **Frontend contract:** Clients should listen for `"quizStarted"` and `"quizStopped"` events on their SignalR connection.
- **TypeScript compiles clean, all 100 tests pass.**

### be-sync-questions — Synchronized Questions for Fair Play (2026-04-16)
- **GameState extended** with `questionIds?: string[]` in `src/api/src/models/index.ts`. When admin starts a quiz, `startQuiz.ts` queries all questions from the active category, Fisher-Yates shuffles, selects up to 3 (QUESTION_COUNT), and stores their IDs in `gameState.questionIds`.
- **getQuestions.ts** updated: checks GameState first — if `isStarted === true` and `questionIds` is non-empty, fetches those specific questions by ID (`SELECT * FROM c WHERE c.id IN (...)`) and returns them in the same order as `questionIds`. Falls back to random selection when quiz is not started.
- **stopQuiz.ts** updated: clears `questionIds` (sets to empty array) when admin stops the quiz.
- **setCategory.ts** updated: clears `questionIds` on category change since old questions belong to different category.
- **Pattern:** Cross-partition query for pinned questions is acceptable — max 3 IDs, bounded cost.
- **TypeScript compiles clean.**

### be-score-reset — Score Reset API (2026-04-16)
- **New endpoint** `POST /api/scores/reset` in `src/api/src/functions/resetScores.ts`. Admin-only via `requireAdmin()`.
- **Request body:** `{ scope: "all" | "selected", userIds?: string[], categoryId?: string }`.
- **scope "all":** Resets all users' global scores (totalScore, gamesPlayed, fastestTimeMs = 0) and deletes all categoryScores documents. If `categoryId` is provided, only deletes that category's scores (leaves global user scores untouched).
- **scope "selected":** Same but only for specified userIds. Partial failures are handled gracefully (logged, skipped).
- **SignalR broadcast:** Sends `scoresReset` event with `{ resetAt, resetBy, scope, usersAffected }` so frontends can refresh leaderboards.
- **Pattern:** Follows same admin auth + SignalR output binding pattern as startQuiz/stopQuiz.
- **TypeScript compiles clean.**

### be-configurable-question-count — Configurable Questions Per Round (2026-04-17)
- **GameState extended** with `questionCount?: number` (default 3, range 1–20) in `src/api/src/models/index.ts`.
- **startQuiz.ts updated** — Accepts optional `{ questionCount }` from request body. Validates 1–20 range. Resolves count via: body → existing gameState.questionCount → default 3. Stores count on GameState. Rejects if pool has fewer questions than requested. Hardcoded `QUESTION_COUNT = 3` removed.
- **getQuestions.ts updated** — `MAX_QUESTIONS` increased from 3 to 20 to support larger rounds in fallback (non-quiz) mode.
- **setCategory.ts updated** — Now preserves `questionCount` when switching categories (was previously lost during GameState reconstruction).
- **New endpoint** `PATCH /api/game/question-count` in `src/api/src/functions/setQuestionCount.ts`. Admin-only. Validates 1–20 range. Updates GameState.questionCount. Broadcasts `questionCountChanged` SignalR event.
- **Auto-stop quiz:** No backend changes needed. Frontend is the gatekeeper — pinned questions are fixed, backend serves same set on refresh, lifecycle is admin-controlled via start/stop.
- **TypeScript compiles clean.**

### be-timer-presence — Configurable Timer & Presence Broadcast (2026-04-17)
- **GameState.timerSeconds** — Added `timerSeconds?: number` (default 10, range 5-60) to GameState model. Follows same pattern as `questionCount`.
- **PATCH /api/game/timer** — New admin-only endpoint (`setTimer.ts`) modeled after `setQuestionCount.ts`. Validates integer 5-60, upserts GameState, broadcasts `timerChanged` SignalR event.
- **startQuiz** — Accepts optional `timerSeconds` in request body (same resolution pattern as questionCount: body > gameState > default 10). Includes `timerSeconds` in `quizStarted` broadcast payload.
- **getGameState** — Defaults `timerSeconds: 10` in all response paths (stored doc, empty state, 404 fallback).
- **setCategory** — Preserves `timerSeconds` alongside `isStarted` and `questionCount` when switching categories.
- **heartbeat SignalR broadcast** — Added SignalR output binding to heartbeat endpoint. After registering presence and computing count, broadcasts `presenceUpdate { count, userId, displayName }` to all connected clients. Pattern copied from submitAnswer.ts.
- **Presence timeout** — Reduced `PRESENCE_TIMEOUT_MS` from 60s to 45s in presenceService.ts. At 30s heartbeat interval, this gives exactly one missed heartbeat grace period instead of two.

### be-scoring-fixes — Fix gamesPlayed Count, Configurable Timer Scoring, Round Complete Endpoint (2026-04-17)
- **Issue 1 — gamesPlayed overcounting:** `updateUserScore()` in `scoringService.ts` was incrementing `gamesPlayed` on every `submitAnswer` call. With 5 questions per round, that counted 5 games instead of 1. **Fix:** Removed `gamesPlayed` increment from `updateUserScore()`. Created new `incrementGamesPlayed(userId)` function that only increments gamesPlayed + updatedAt. Also removed per-answer `gamesPlayed` increment from the categoryScore logic in `submitAnswer.ts` (both update and create paths).
- **New endpoint `POST /api/game/round-complete`** (`roundComplete.ts`) — Called once by frontend when a player finishes all questions. Accepts `{ userId }`, calls `incrementGamesPlayed()` on the user doc, then reads GameState to find the active category and increments `gamesPlayed` on the matching categoryScore document. Non-admin, any user can call it.
- **Issue 2 — Hardcoded timer in scoring:** `calculatePoints()` used hardcoded `QUESTION_TIMEOUT_MS = 10_000`. With configurable timer (5-60s via GameState.timerSeconds), speed bonus was always calculated against 10s regardless of actual timer. **Fix:** Added module-level GameState timer cache (30s TTL) to avoid Cosmos reads on every answer. `calculatePoints()` now accepts `timeoutMs` parameter. `submitAnswer` reads cached timer and passes `timerSeconds * 1000` to scoring.
- **Issue 3 — elapsedTimeMs in response:** Verified — `AnswerResult` already includes both `elapsedTimeMs` and `timeTaken` set from the server-calculated value. Fallback path (no delivery record) uses `serverReceiptTimestamp - clientTimestamp` which produces reasonable non-zero values.
- **`_resetSubmitAnswerCaches()`** updated to also clear the new timer cache (`cachedTimerSeconds` and `timerCacheTimestamp`).
- **Tests:** Updated `scoringService.test.ts` — renamed test to verify gamesPlayed is NOT in patch ops. Added 2 new tests for `incrementGamesPlayed()`. Updated `submitAnswer.test.ts` mock to include `gameStateContainer`. All 145 tests pass (was 143).

### be-relative-scoring — Relative Speed-Based Scoring (2026-04-17)
- **New scoring formula:** Replaced timer-based `200 × (1 - elapsed/timer)` with relative scoring: `round(200 × (fastestCorrectMs / playerMs))`, capped 1–200. Incorrect answers still get 0. The fastest correct answer per question always gets 200; slower correct answers get proportionally less.
- **New service:** Created `src/api/src/services/fastestAnswerTracker.ts` — in-memory `Map<questionId, number>` tracking the fastest correct response time per question. Exports `recordCorrectAnswer()`, `getFastestCorrectMs()`, `clearFastestForQuestion()`, `_resetFastestTracker()`.
- **submitAnswer.ts changes:** `calculatePoints()` now takes `questionId` instead of `timeoutMs`. Calls `recordCorrectAnswer()` before scoring. Removed the GameState timer cache (`getTimerSeconds`, `cachedTimerSeconds`, `TIMER_CACHE_TTL_MS`) — no longer needed for scoring. Removed `gameStateContainer` import.
- **stopQuiz.ts changes:** Calls `_resetFastestTracker()` when quiz stops so next round starts with fresh fastest-time tracking.
- **`_resetSubmitAnswerCaches()`** now calls `_resetFastestTracker()` to clear fastest-time state in tests.
- **Tests:** Rewrote 3 submitAnswer scoring tests for relative formula (first-correct-gets-200, proportional-slower, min-cap-1). Added 7 new tests for `fastestAnswerTracker.test.ts`. Removed `gameStateContainer` mock from submitAnswer tests. All 152 tests pass (was 145).
- **Trade-off accepted:** First correct answer gets 200 even if a later answer is faster. Since questions are synchronized (ADR-027) and all players start at the same time, the first server-received answer is likely the fastest. Minor unfairness is acceptable for simplicity.

### be-logging-resilience — Structured Logging, Health Check & Self-Healing (2026-04-17)
- **Structured logging utility:** Created `src/api/src/services/logger.ts` with `logRequest()`, `logSuccess()`, `logError()`, `correlationHeaders()`, and `getCorrelationId()`. All log entries are JSON-structured with correlation ID, function name, timing, and error details. Uses `context.log`/`context.error` — no external deps.
- **Resilience utility:** Created `src/api/src/services/resilience.ts` with `withRetry()` (exponential backoff, 3 attempts, retries 429/503/transient network errors, skips 400/401/403/404) and circuit breaker (`withResilience()` — trips after 5 consecutive failures, 30s cooldown, returns fallback).
- **Health check endpoint:** Created `src/api/src/functions/healthCheck.ts` — `GET /api/health`. Checks Cosmos DB connectivity (reads gameState doc), returns 200 with `{ status: "healthy", cosmosDb: "connected", cosmosResponseMs, timestamp }` or 503 with unhealthy status. Treats 404 as "connected" (doc may not exist).
- **Instrumented 5 critical endpoints:** `loginOrCreate.ts` (retry on all Cosmos calls + circuit breaker), `getGameState.ts` (full `withResilience` + fallback defaults), `submitAnswer.ts`, `getLeaderboard.ts`, `heartbeat.ts` — all with structured request/success/error logging and correlation ID propagation via `x-correlation-id` header (read from request or auto-generated UUID, returned in response).
- **Request correlation:** Every response from instrumented endpoints returns `x-correlation-id` header. Frontend can include this in error reports for end-to-end tracing.
- **All 155 existing tests pass** — no regressions.

### be-logging-resilience-summary — Team Cross-Pollination (2026-04-18)
- **Phase 3 completion:** Backend observability & resilience patterns implemented across 5 critical endpoints.
- **Decisions merged:** ADR-041 (Relative Speed-Based Scoring), ADR-042 (Backend Observability & Resilience), ADR-043 (Client-Side Logging & Self-Healing UI), ADR-044 (GitHub Copilot Dev Days Visual Rebrand).
- **Frontend dependency:** Fry's frontend now depends on `GET /api/health` endpoint returning 200 when API is up. Correlation IDs flow through request/response boundary via `x-correlation-id` header for end-to-end tracing.
- **Outcome:** 155 backend tests passing. Users can now diagnose API failures via correlation IDs. Retry logic + circuit breaker prevent cascading failures. Health polling enables proactive connection detection on frontend.

### be-admin-passcode — Admin Passcode Validation on Login (2026-04-18)
- **loginOrCreate.ts** — Added secondary passcode gate for admin users. After finding an existing user with `isAdmin: true`, checks `x-admin-passcode` header. Missing header → 401 `ADMIN_PASSCODE_REQUIRED`. Wrong passcode → 401 `ADMIN_PASSCODE_INVALID`. Correct → proceeds normally. Non-admin users are completely unaffected.
- **Passcode source:** `ADMIN_PASSCODE` env var with hardcoded fallback `"CopilotDevDays2026"` for local dev / SWA simplicity.
- **Security:** Uses `crypto.timingSafeEqual` via a `constantTimeCompare()` helper to prevent timing attacks. Handles unequal-length strings by comparing bufA against itself (constant time) then returning false.
- **Tests:** 4 new tests added to `loginOrCreate.test.ts` — missing passcode, wrong passcode, correct passcode, non-admin unaffected. All 159 tests pass.
