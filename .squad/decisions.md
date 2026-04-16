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
