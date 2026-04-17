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
