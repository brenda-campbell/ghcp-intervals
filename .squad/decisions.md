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
