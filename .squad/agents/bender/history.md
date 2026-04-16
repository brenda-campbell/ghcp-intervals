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
