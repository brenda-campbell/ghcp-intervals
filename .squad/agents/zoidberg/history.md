# Zoidberg — E2E Tester History

## Project Context
- **Project:** Fastest Finger Quiz — competitive speed-trivia game
- **Owner:** Brenda Campbell
- **Stack:** React 19 + Vite, Azure Functions v4, Cosmos DB, SignalR, Bicep IaC
- **Live site:** https://blue-rock-087013e03.7.azurestaticapps.net
- **Created:** 2026-04-17

## Learnings

### 2025-07-22 — Post-Cosmos-Outage E2E Verification

**Context:** Cosmos DB outage (public network access disabled) caused login failures, API errors with stuck "Verifying account" spinners. Outage was fixed; Zoidberg ran full E2E suite to verify recovery.

**Results: 7/7 PASS ✅** (22.1s total, Chromium headless)

| # | Test | Result | Key Observation |
|---|------|--------|-----------------|
| 1 | Fresh Login Flow | ✅ PASS | Landing page renders, email+name entry works, "Enter the Game" submits, app shell loads with Fastest Finger header and Quiz/Leaderboard tabs. No errors. |
| 2 | Quiz Tab (Waiting Room) | ✅ PASS | "Waiting for quiz to start…" message visible. Quiz is in stopped state. |
| 3 | Leaderboard Tab | ✅ PASS | Table renders with real data — Brenda (3,593), butthead (1,799), Test Verifier (0). Cosmos reads working. |
| 4 | Admin Login Flow | ✅ PASS | brencampbell@microsoft.com recognized as admin. 3 tabs visible (Quiz, Leaderboard, Admin). Admin panel loads with content. |
| 5 | Admin Panel Sections | ✅ PASS | Quiz control ("Quiz is STOPPED" + Start/Stop button), Online Players, Category Management, Score Management — all rendered. |
| 6 | Logout & Re-login | ✅ PASS | Sign-out returns to EmailEntry. Re-login with new identity works cleanly. |
| 7 | Return User (localStorage) | ✅ PASS | Navigate away and back → auto-login succeeds. No stuck spinner. |

**Screenshots:** 10 captured at `src/frontend/e2e/screenshots/`

**Verdict:** The Cosmos DB fix fully resolved all reported issues. Fresh login, return-user auto-login, admin panel, leaderboard — everything works end-to-end.

**Technical notes for future tests:**
- QuizControlSection has no "Quiz Control" heading — it shows "Quiz is LIVE/STOPPED" inline. Use `/quiz is/i` not `/quiz control/i`.
- Leaderboard page has multiple elements matching "leaderboard" and "rank" — use `getByRole('heading')` or `.first()` to avoid strict mode violations.
- The app uses `#email` and `#displayName` as stable input IDs. Submit button is `button[type="submit"]`.
- Sign-out button has `title="Sign out"` — stable selector.
- Admin tab only appears when `user.isAdmin === true`.

### 2025-07-22 — New Feature E2E Tests (Theme, Quiz Complete, Question Count)

**Context:** Three new features needed E2E testing: dark/light theme toggle, quiz-complete no-replay screen (admin-started quiz), and configurable question count selector in admin panel.

**Results: 10/10 PASS ✅** (1.2m total, Chromium headless)

| # | Test | Result | Key Observation |
|---|------|--------|-----------------|
| 1 | Fresh Login Flow | ✅ PASS | Stable as before |
| 2 | Quiz Tab (Waiting Room) | ✅ PASS | Stable |
| 3 | Leaderboard Tab | ✅ PASS | Stable |
| 4 | Admin Login Flow | ✅ PASS | Stable |
| 5 | Admin Panel Sections | ✅ PASS | Stable |
| 6 | Logout & Re-login | ✅ PASS | Stable |
| 7 | Return User (localStorage) | ✅ PASS | Stable |
| 8 | Dark/Light Theme Toggle | ✅ PASS | Theme toggle button has title="Switch to light/dark mode". Toggling changes `--color-background` CSS variable. Toggle is stateful round-trip. |
| 9 | Quiz Complete (No Replay) | ✅ PASS | Admin-started quiz shows "Quiz Complete!" + "Waiting for the next round…" with NO "Play Again" button. Free-play shows "Round Complete!" with Play Again. |
| 10 | Configurable Question Count | ✅ PASS | `#qcount` select element visible when quiz is STOPPED (hidden when LIVE). Has 20 options (1–20). Value change works. |

**Screenshots:** 15 captured at `src/frontend/e2e/screenshots/`

**Technical notes for future tests:**
- Theme toggle button: `button[title="Switch to light mode"]` (dark) or `button[title="Switch to dark mode"]` (light). Use `.or()` to handle either initial state.
- `clearAppStorage` should also clear `localStorage.removeItem('theme')` to get deterministic default state.
- The Quiz tab button `locator('button', { hasText: 'Quiz' })` matches BOTH "Quiz" tab and "Stop Quiz" button when quiz is live. Use `getByRole('button', { name: 'Quiz', exact: true })` instead.
- `getByText('LIVE')` matches multiple elements on admin page (connection badge + quiz status badge). Use `getByRole('button', { name: /stop quiz/i })` to detect live quiz state.
- `getByText(/waiting for/i)` matches TWO elements on quiz-complete screen. Use specific text like `getByText('Waiting for the next round')`.
- Question count selector `#qcount` only renders when quiz is STOPPED (`!isStarted` conditional). Must stop quiz first.
- Deployed site may lag behind source code — features may not be available until redeployed. During this session, initial runs failed because the deploy was stale, then passed after automatic redeployment.
