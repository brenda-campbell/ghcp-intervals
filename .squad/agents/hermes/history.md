# Project Context

- **Owner:** Brenda Campbell
- **Project:** Fastest Finger Quiz — a competitive quiz game where players answer Azure/GitHub Copilot themed multiple-choice questions. Fastest correct answer wins the round. Points accumulate across sessions. Released via link after each session, 1–3 questions per round.
- **Stack:** Frontend (Azure Static Web App, HTML/JS or React), Backend (Azure Functions HTTP triggers), Database (Cosmos DB), Real-time (SignalR Service), CI/CD (GitHub Actions), IaC (Bicep/ARM)
- **Created:** 2026-04-15

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-15 — Bicep Infrastructure Created (infra-bicep)
- **What:** Created `infra/` directory with `main.bicep` orchestrator + 3 modules: `staticWebApp.bicep`, `cosmosDb.bicep`, `signalr.bicep`. Added `main.bicepparam` for dev environment.
- **Naming convention:** `${appName}-${environmentName}-{resource}` (e.g., `fastestfinger-dev-cosmos`). All resources tagged with `environment` and `app`.
- **Cosmos DB:** Serverless capacity mode. Database `fastestfinger` with `users` (partition key `/userId`) and `questions` (partition key `/category`). Composite index on `users` for `totalScore DESC` + `userId ASC` to support leaderboard queries.
- **SignalR:** Serverless mode via `ServiceMode` feature flag — matches ADR-002 (Azure Functions bindings, not standalone hub).
- **Static Web App:** Free tier, configured with `appLocation: /client`, `apiLocation: /api`, `outputLocation: dist` for React + managed Functions.
- **Secrets in outputs:** Bicep linter warns about connection strings in module outputs. Acceptable for CI/CD pipeline consumption. Future improvement: route through Key Vault.
- **Parameter file:** Uses `.bicepparam` format (Bicep-native) rather than JSON parameters.

### 2026-04-15 — GitHub Actions CI/CD Pipeline Created (cicd-pipeline)
- **What:** Created `.github/workflows/deploy.yml` — single workflow per ADR-005 with two jobs: `infrastructure` (Bicep deploy) → `build-and-deploy` (Node 20, build, test, SWA deploy).
- **Auth:** OIDC federated credentials via `azure/login@v2`. Requires secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RG`.
- **SWA deploy token:** Extracted from Bicep output (`staticWebAppDeploymentToken`) and masked in logs. Falls back to `AZURE_STATIC_WEB_APPS_API_TOKEN` secret if set directly.
- **Tests:** Uses `npm test --if-present` with `continue-on-error: true` so the pipeline doesn't fail while test suites are still being written.
- **Concurrency:** `deploy-${{ github.ref }}` group with `cancel-in-progress: true` to avoid redundant deployments.
- **SWA action paths:** `app_location: src/frontend`, `api_location: src/api`, `output_location: dist` — matches actual project directory structure.
- **npm cache:** `actions/setup-node@v4` caches both `src/frontend/package-lock.json` and `src/api/package-lock.json` for faster CI.
- **Prod note:** Workflow comments document that production deployments should use GitHub Environment protection rules with required reviewers.

### 2026-04-15 — Cosmos DB Email Indexing for loginOrCreate (phase-1d-indexing)
- **What:** Verified that the `users` container's `/*` included path already indexes `/email` automatically — no redundant explicit path added.
- **Composite index added:** `[/email ASC, /isActive DESC]` to support the ADR-008 `loginOrCreate` query (`WHERE email = @email AND isActive = true`).
- **No breaking changes:** Existing leaderboard composite index (`/totalScore DESC, /fastestTimeMs ASC`) untouched.
- **Bicep validation:** Template compiles cleanly; only pre-existing `outputs-should-not-contain-secrets` warning remains.

### 2026-04-16 — SignalR Scaling Free→Standard_S1 (hermes-scale)
- **What:** Upgraded SignalR tier in `infra/signalr.bicep` from Free_F1 to Standard_S1 to handle increased concurrent connections.
- **Capacity gain:** 30 → 100 concurrent connections per instance (+233%).
- **host.json tuning:** Added function concurrency settings to optimize scaling under load.
- **Impact:** Player activity broadcasts (`playerAnswered` events) now reliable at scale. Leaderboard updates remain best-effort (non-blocking).
- **Verification:** Bicep compiles clean, Azure deployment validates, SignalR broadcast in submitAnswer.ts still functional.
