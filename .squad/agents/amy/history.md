# Project Context

- **Owner:** Brenda Campbell
- **Project:** Fastest Finger Quiz — a competitive quiz game where players answer Azure/GitHub Copilot themed multiple-choice questions. Fastest correct answer wins the round. Points accumulate across sessions. Released via link after each session, 1–3 questions per round.
- **Stack:** Frontend (Azure Static Web App, HTML/JS or React), Backend (Azure Functions HTTP triggers), Database (Cosmos DB), Real-time (SignalR Service), CI/CD (GitHub Actions), IaC (Bicep/ARM)
- **Created:** 2026-04-15

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **Test infra**: vitest + @testing-library/react + jsdom. Config in `vitest.config.ts`, setup in `src/test/setup.ts`. Run with `npm test`.
- **Fake timers vs async**: Do NOT use `vi.useFakeTimers()` in integration tests that rely on `await act(async () => { render(...) })` — it blocks promise resolution and causes timeouts. Use real timers and `waitFor()` with generous timeouts instead.
- **Double-click guard**: `QuestionPage.handleSelect` uses `if (submitting || selectedIndex !== null)` as its idempotency guard. After the first `act()` completes, React state is flushed, so the second click in a separate `act()` is properly blocked. Two clicks inside the same `act()` will both fire because state hasn't flushed yet.
- **Leaderboard error text**: The error message appears in both `AlertTitle` and the error state text, so `getByText` throws on duplicates. Use a selector to disambiguate.
- **Mock UI components**: All shadcn/ui components must be mocked for unit tests since they rely on CSS/Radix internals that jsdom doesn't support. Use simple HTML element stubs with `data-testid` attributes.
- **AnimatedScore / ScoreDelta**: These components use `requestAnimationFrame` internally. Must mock `performance.now()` and `requestAnimationFrame` to make them render deterministically in tests.

- **Test infra:** vitest installed as dev dep; `npm test` runs `vitest run`; vitest.config.ts at `src/api/`; test files excluded from tsconfig to avoid tsc conflicts.
- **Mocking Azure Functions handlers:** Handlers are not exported — they're registered via `app.http()` side-effect. Mock `@azure/functions` and capture handler from `vi.mocked(app.http).mock.calls[0][1].handler` after dynamic import.
- **Module import inconsistency:** `createUser.ts` and `getUser.ts` use extensionless imports (`from "../services/cosmosClient"`), while other function files use `.js` extensions. vitest resolves both to the same module, so one mock covers both.
- **calculatePoints is private:** Scoring logic in `submitAnswer.ts` is not exported. Test indirectly through handler by controlling delivery timestamps and mocking Cosmos question lookups.
- **Score update is best-effort:** `submitAnswer` catches score persistence errors and still returns the answer result. Tests verify this resilience.
- **76 tests across 9 files** covering services (scoringService, leaderboardService, questionDeliveryTracker) and all 6 Azure Function endpoints with edge cases (validation, 404s, DB errors, timing, double-submit).
- **startQuiz + stopQuiz tests (22 new, 122 total):** Both endpoints require existing game state — they return 400 if no category has been set (no auto-create). Followed setCategory/toggleUserStatus patterns: mock `gameStateContainer.item().read()` + `items.upsert()`, mock `requireAdmin`, check SignalR `extraOutputs.set` for `quizStarted`/`quizStopped` targets. Edge cases: idempotent start/stop, missing game state (404 and undefined resource), Cosmos upsert failures, field preservation across upsert.
- **resetScores tests (14 tests):** `src/api/src/functions/__tests__/resetScores.test.ts`. Tests `POST /api/scores/reset` — admin-only endpoint. Requires mocking both `usersContainer` (query+item+upsert) and `categoryScoresContainer` (query+item+delete) since the handler touches both containers. Key patterns: `usersContainer.item(id).mockImplementation()` for per-user read responses, `categoryScoresContainer.item().delete()` for cascade deletes. Edge cases: scope validation, category-only reset skips user upsert but still counts usersAffected, empty userIds array blocked.
- **syncQuestions tests (7 tests):** `src/api/src/functions/__tests__/syncQuestions.test.ts`. Cross-endpoint behavior tests for question pinning. Imports 4 modules (startQuiz, getQuestions, stopQuiz, setCategory) in one test file — extracts handlers by name from `app.http.mock.calls.find(c => c[0] === "name")`. Verifies: startQuiz stores questionIds on GameState, getQuestions returns pinned questions in order when isStarted=true, stopQuiz clears questionIds, setCategory clears questionIds on category change.
- **Pre-existing startQuiz.test.ts broken by Bender's sync questions update:** The old tests don't mock `questionsContainer`, which the updated `startQuiz.ts` now imports. 6 tests fail with 500 errors. Coordinator fixed by adding questionsContainer to mock + providing question pool in happy-path tests. ADR-029 documents the issue and solution.
- **143 tests passing** — Verified after all fixes applied. All new tests (resetScores + syncQuestions) integrated cleanly.
- **Linear scoring formula tests (155 total):** Rewrote submitAnswer scoring tests for new `score = max(0, round(200 × (1 - elapsedTimeMs / timeoutMs)))` formula. Removed 3 old relative-scoring tests (first-answer-always-200, proportional, min-1-cap). Added 8 new tests: instant(200), 2s(160), half-timeout(100), at-timeout(0), over-timeout(0), custom timerSeconds, default fallback. Added `gameStateContainer` mock for timerSeconds reads. Removed fastestAnswerTracker mock (module deleted).
