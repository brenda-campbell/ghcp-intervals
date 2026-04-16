# Project Context

- **Owner:** Brenda Campbell
- **Project:** Fastest Finger Quiz — competitive quiz game with Azure/GitHub Copilot themed questions. Fastest correct answer wins. Points accumulate across sessions.
- **Stack:** Azure Static Web App (React/HTML), Azure Functions (HTTP triggers), Cosmos DB, SignalR Service, GitHub Actions, Bicep IaC
- **Created:** 2026-04-15

## Core Context

Scribe initialized. Team cast from Futurama universe: Leela (Lead), Fry (Frontend), Bender (Backend), Hermes (DevOps), Amy (Tester).

## Recent Updates

📌 Team initialized on 2026-04-15 — full roster hired
📌 Phase 1A–1D completed on 2026-04-16 — user system infrastructure (ADR-008 through ADR-012)
📌 Phase 2A completed on 2026-04-16T22:23:35Z — Synchronized Questions + Score Reset
  - Bender: Pinned question IDs on startQuiz, implemented POST /api/scores/reset with flexible scope
  - Fry: Built ScoreResetSection UI with checkbox selection and inline confirmation
  - Amy: Wrote 21 new tests (resetScores × 14, syncQuestions × 7)
  - Decisions merged: ADR-027, ADR-028, ADR-029
  - Test suite: 143 tests passing (all green after startQuiz.test.ts mock fix by Coordinator)

## Learnings

<!-- Append new learnings below. -->
