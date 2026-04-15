# Project Context

- **Owner:** Brenda Campbell
- **Project:** Fastest Finger Quiz — a competitive quiz game where players answer Azure/GitHub Copilot themed multiple-choice questions. Fastest correct answer wins the round. Points accumulate across sessions. Released via link after each session, 1–3 questions per round.
- **Stack:** Frontend (Azure Static Web App, HTML/JS or React), Backend (Azure Functions HTTP triggers), Database (Cosmos DB), Real-time (SignalR Service), CI/CD (GitHub Actions), IaC (Bicep/ARM)
- **Created:** 2026-04-15

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2025-07-14 — PRD Decomposition:** Broke down the Fastest Finger Quiz PRD into 18 work items across 4 waves. Key architecture calls: server-authoritative timing (ADR-003), no correct answer sent to client (ADR-007), SWA managed functions for simplicity (ADR-004), single Bicep template with modules (ADR-006). The question pool lives in Cosmos DB `questions` container, player data in `users` container. SignalR uses Functions bindings in serverless mode. Single GitHub Actions workflow handles build + test + deploy.
- **2025-07-14 — Team Parallelism:** Waves 1-2 are designed so Fry (frontend) and Bender (backend) can work in parallel once scaffolding is up. Hermes is the critical path in Wave 1 — IaC and CI/CD must land before anyone can deploy. Amy joins in Wave 3-4 for integration and polish testing.
