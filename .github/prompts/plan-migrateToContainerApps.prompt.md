# Plan: Migrate to Azure Container Apps (Feature Branch — Isolated)

## TL;DR
Containerize both the React frontend (Nginx) and Azure Functions backend into Docker images, push to ACR, and deploy to Azure Container Apps — all on the `feature/containerisation` branch with a **completely separate** workflow, GitHub Environment, resource group (`rg-fastestfinger-aca-dev`), and infrastructure. The existing `main` branch, its `deploy.yml`, and `rg-fastestfinger-dev` are completely untouched.

## Isolation Strategy

| Concern | How it's protected |
|---------|-------------------|
| **Branch** | All work on `feature/containerisation`. Existing `deploy.yml` on `main` is never modified. |
| **Workflow** | New `.github/workflows/deploy-aca.yml` triggers **only** on `push: [feature/containerisation]` + `workflow_dispatch`. Existing `deploy.yml` only triggers on `main` — zero overlap. |
| **Secrets** | New GitHub Environment `aca-dev` with its own scoped secrets. Repo-level secrets used by SWA pipeline are never referenced. |
| **Resource group** | Deploys to `rg-fastestfinger-aca-dev` (new). Existing `rg-fastestfinger-dev` untouched. |
| **Infrastructure** | New `infra/main-aca.bicep` orchestrator. Existing `main.bicep` left as-is. Cosmos DB, SignalR, ACR, ACA all provisioned fresh in the new RG. |
| **Teardown** | If experiment fails: delete `rg-fastestfinger-aca-dev`, delete GH Environment, delete branch. Zero residue. |

## Architecture

```
Internet → ACA Environment (rg-fastestfinger-aca-dev)
  ├── frontend-app (Nginx, external ingress, port 80)
  │     ├── Serves React SPA
  │     └── Proxies /api/* → api-app (internal)
  └── api-app (Azure Functions Node 20, internal ingress, port 80)
        ├── 27 HTTP-triggered Functions
        ├── → Cosmos DB (fresh, in same RG)
        └── → Azure SignalR Service (fresh, in same RG)
```

- **Frontend**: external ingress — public URL
- **API**: internal ingress only — accessible only within the ACA environment
- **Nginx reverse proxy**: browser calls `/api/*` → Nginx forwards to API container → same-origin, no CORS issues
- **SignalR**: negotiate via `/api/negotiate` → browser connects directly to Azure SignalR Service (WebSocket)

---

## Phase 0: Branch & Environment Setup (manual prerequisites)

### Step 0a — Create Feature Branch
- `git checkout -b feature/containerisation` from `main`
- All subsequent work happens on this branch

### Step 0b — Create Azure Resource Group
- `az group create --name rg-fastestfinger-aca-dev --location northeurope`
- Completely separate from `rg-fastestfinger-dev`

### Step 0c — Create GitHub Environment `aca-dev`
- In GitHub repo → Settings → Environments → New environment: `aca-dev`
- Add these **environment-scoped secrets**:

| Secret | Value | Notes |
|--------|-------|-------|
| `AZURE_CLIENT_ID` | Same or new service principal | |
| `AZURE_CLIENT_SECRET` | Matching client secret | For Cosmos AAD auth |
| `AZURE_TENANT_ID` | Same tenant | |
| `AZURE_SUBSCRIPTION_ID` | Same subscription | |
| `ACA_AZURE_RG` | `rg-fastestfinger-aca-dev` | Distinct name from repo-level `AZURE_RG` |

### Step 0d — OIDC Federated Credential
- The existing OIDC app registration likely has a federated credential for `ref:refs/heads/main`.
- Add a **new** federated credential for the `aca-dev` environment:
  - Subject: `repo:brenda-campbell/ghcp-intervals:environment:aca-dev`
  - Issuer: `https://token.actions.githubusercontent.com`
  - Audience: `api://AzureADTokenExchange`
- This allows the `aca-dev` environment jobs to authenticate via OIDC without affecting the existing main credential.

### Step 0e — Service Principal Permissions
- The service principal needs `Contributor` role on `rg-fastestfinger-aca-dev`
- `az role assignment create --assignee <AZURE_CLIENT_ID> --role Contributor --scope /subscriptions/<SUB_ID>/resourceGroups/rg-fastestfinger-aca-dev`

---

## Phase 1: Container Setup (all steps parallel, no dependencies)

### Step 1 — API Dockerfile
**Create**: `src/api/Dockerfile`
- Base: `mcr.microsoft.com/azure-functions/node:4-node20`
- Copy `package.json` + `package-lock.json`, run `npm ci --production`
- Copy `dist/`, `host.json`, `src/data/` (JSON question files)
- Set env: `AzureWebJobsScriptRoot=/home/site/wwwroot`
- Expose port 80 (default for Functions host)

### Step 2 — Frontend Dockerfile
**Create**: `src/frontend/Dockerfile`
- Stage 1 (build): Node 20 Alpine, `npm ci`, `npm run build` → `/app/dist`
- Stage 2 (serve): Nginx Alpine, copy build output to `/usr/share/nginx/html`, copy Nginx template
- Expose port 80

### Step 3 — Nginx Configuration
**Create**: `src/frontend/nginx.conf.template`
- SPA fallback: `try_files $uri $uri/ /index.html`
- Reverse proxy: `location /api/ { proxy_pass http://${API_FQDN}/api/; }` with WebSocket upgrade headers
- Uses Nginx's built-in `envsubst` template mechanism (auto-processed from `/etc/nginx/templates/`)
- `API_FQDN` env var set by Container App configuration to internal hostname of API container

### Step 4 — Docker Ignore Files
**Create**: `src/api/.dockerignore` — exclude node_modules, tests, local.settings.json
**Create**: `src/frontend/.dockerignore` — exclude node_modules, test-results, e2e

### Step 5 — Local Development (docker-compose)
**Create**: `docker-compose.yml` (project root)
- Services: `frontend` (build context: src/frontend), `api` (build context: src/api)
- API env vars: `CosmosDBConnectionString`, `AzureSignalRConnectionString` (from `.env` file)
- Frontend env: `API_FQDN=api` (Docker Compose service name)
- Ports: frontend → 8080:80

---

## Phase 2: Infrastructure (Bicep) — new files, existing Bicep untouched

### Step 6 — Container Registry Module
**Create**: `infra/modules/containerRegistry.bicep`
- Resource: `Microsoft.ContainerRegistry/registries@2023-07-01`
- SKU: Basic
- Admin user enabled (for ACA image pull)
- Name: `${appName}${environmentName}acr` (no hyphens — ACR naming constraint)
- Outputs: `loginServer`, `name`, `adminUsername`, `adminPassword`

### Step 7 — Container Apps Environment Module
**Create**: `infra/modules/containerAppsEnvironment.bicep`
- Resource: `Microsoft.OperationalInsights/workspaces` (Log Analytics)
- Resource: `Microsoft.App/managedEnvironments@2024-03-01`
- Name: `${appName}-${environmentName}-env`
- Log Analytics integration for container logs
- Outputs: `environmentId`, `defaultDomain`

### Step 8 — API Container App Module
**Create**: `infra/modules/containerApp-api.bicep`
- Resource: `Microsoft.App/containerApps@2024-03-01`
- Name: `${appName}-${environmentName}-api`
- Ingress: internal only, port 80, HTTP/1.1 + HTTP/2
- Image: `${acrLoginServer}/${appName}-api:latest` (initial placeholder)
- System-assigned managed identity
- Secrets: `AzureSignalRConnectionString`, `AZURE_CLIENT_SECRET`
- Env vars: `COSMOS_ENDPOINT`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `FUNCTIONS_WORKER_RUNTIME=node`, `AzureWebJobsStorage=""`
- Scale: min 0, max 5, rule: HTTP concurrent requests (10)
- Health probe: `/api/health`

### Step 9 — Frontend Container App Module
**Create**: `infra/modules/containerApp-frontend.bicep`
- Resource: `Microsoft.App/containerApps@2024-03-01`
- Name: `${appName}-${environmentName}-frontend`
- Ingress: external, port 80, HTTP/1.1
- Image: `${acrLoginServer}/${appName}-frontend:latest` (initial placeholder)
- Env var: `API_FQDN` = API container app's internal FQDN
- Scale: min 0, max 3, rule: HTTP concurrent requests (50)

### Step 10 — New ACA Bicep Orchestrator
**Create**: `infra/main-aca.bicep` (NEW file — does NOT modify `main.bicep`)
- Modules: `containerRegistry`, `containerAppsEnvironment`, `cosmosDb` (reuse existing module), `signalr` (reuse existing module), `containerApp-api`, `containerApp-frontend`
- Wire outputs: ACR login server → container apps, Cosmos endpoint → API app, SignalR conn → API app
- Outputs: `frontendUrl`, `acrLoginServer`, `acrName`, `apiAppName`, `frontendAppName`, `cosmosDbEndpoint`, `signalRConnectionString`
- Add Cosmos DB RBAC: assign `Cosmos DB Built-in Data Contributor` role to API app's managed identity principal ID

**Create**: `infra/main-aca.bicepparam`
- `location = 'northeurope'`
- `environmentName = 'dev'`
- `appName = 'fastestfinger'`

---

## Phase 3: CI/CD Pipeline — new workflow file

### Step 11 — Create New GitHub Actions Workflow
**Create**: `.github/workflows/deploy-aca.yml` (NEW file — does NOT modify `deploy.yml`)

```yaml
name: Deploy to Container Apps
on:
  push:
    branches: [feature/containerisation]
  workflow_dispatch:
```

**Job 1: `infrastructure`**
- `environment: aca-dev` — uses environment-scoped secrets
- Azure Login (OIDC) with `aca-dev` secrets
- Deploy `infra/main-aca.bicep` to `${{ secrets.ACA_AZURE_RG }}`
- Extract outputs: ACR login server, ACR name, API app name, frontend app name, Cosmos endpoint, SignalR connection string, API internal FQDN

**Job 2: `build-and-push`** (depends on `infrastructure`)
- `environment: aca-dev`
- Checkout code
- Setup Node.js 20
- Install + build + test frontend
- Install + build + test API
- Azure Login (OIDC)
- Login to ACR: `az acr login --name <ACR_NAME>`
- Docker build API: `docker build -t ${ACR}/fastestfinger-api:${GITHUB_SHA} -t ${ACR}/fastestfinger-api:latest src/api`
- Docker build frontend: `docker build -t ${ACR}/fastestfinger-frontend:${GITHUB_SHA} -t ${ACR}/fastestfinger-frontend:latest src/frontend`
- Push all tags

**Job 3: `deploy`** (depends on `build-and-push`)
- `environment: aca-dev`
- Azure Login (OIDC)
- Update API container app image + env vars (Cosmos endpoint, SignalR, AAD creds via `az containerapp update`)
- Update frontend container app image + set `API_FQDN` env var
- Print frontend URL for verification

---

## Phase 4: Health Endpoint

### Step 12 — Add Health Check Function
**Create**: `src/api/src/functions/health.ts`
- Simple `app.http("health", ...)` returning 200 with `{ status: "ok" }`
- Used as ACA container health probe target: `/api/health`

---

## Relevant Files

### New Files (14 total)
- `src/api/Dockerfile` — Functions container image
- `src/api/.dockerignore` — Exclude dev artifacts
- `src/frontend/Dockerfile` — Multi-stage build + Nginx
- `src/frontend/.dockerignore` — Exclude dev artifacts
- `src/frontend/nginx.conf.template` — SPA routing + API reverse proxy
- `docker-compose.yml` — Local container dev
- `infra/modules/containerRegistry.bicep` — ACR
- `infra/modules/containerAppsEnvironment.bicep` — ACA Environment + Log Analytics
- `infra/modules/containerApp-api.bicep` — API container
- `infra/modules/containerApp-frontend.bicep` — Frontend container
- `infra/main-aca.bicep` — ACA orchestrator (separate from `main.bicep`)
- `infra/main-aca.bicepparam` — ACA parameters
- `.github/workflows/deploy-aca.yml` — ACA CI/CD pipeline (separate from `deploy.yml`)
- `src/api/src/functions/health.ts` — Health check endpoint

### Files NOT Modified
- `infra/main.bicep` — Untouched (SWA pipeline)
- `infra/main.bicepparam` — Untouched
- `infra/modules/staticWebApp.bicep` — Untouched (still used by main branch)
- `.github/workflows/deploy.yml` — Untouched (still deploys SWA on main)
- `staticwebapp.config.json` — Untouched
- All source code in `src/api/src/` — No changes (except new `health.ts`)
- All source code in `src/frontend/src/` — No changes

### Reused Modules (no changes needed)
- `infra/modules/cosmosDb.bicep` — Referenced by `main-aca.bicep`
- `infra/modules/signalr.bicep` — Referenced by `main-aca.bicep`

---

## Verification

1. **Local**: `docker-compose up --build` → frontend at `localhost:8080`, API at `localhost:8080/api/health`
2. **Push feature branch** → `deploy-aca.yml` runs, deploys to `rg-fastestfinger-aca-dev`
3. **Existing main untouched**: Confirm `deploy.yml` did NOT trigger on the feature branch push
4. **ACA smoke test**: `curl https://<frontend-aca-url>/api/getGameState`
5. **SignalR**: Two browser tabs → start quiz → real-time updates in both
6. **Existing SWA still works**: Visit current SWA URL → confirms unchanged
7. **Scale**: Verify scale-to-zero after idle, scale-up on next request
8. **Rollback**: ACR images tagged by commit SHA for easy rollback

---

## Decisions & Scope

- **In scope**: Full containerization (frontend + backend), ACR, ACA, isolated GH Actions pipeline, GH Environment secrets, docker-compose, health endpoint
- **Out of scope**: Custom domain / SSL (ACA provides auto-TLS on `*.azurecontainerapps.io`), Dapr, WAF/CDN, modifying main branch, deleting SWA resources
- **Branch strategy**: Feature branch only. When ready to promote, merge to `main` and update `deploy.yml` to replace SWA with ACA (second phase)
- **SignalR mode**: Stays Serverless — Functions container uses output bindings
- **Fully independent infra**: Fresh Cosmos DB (empty) + SignalR in new RG. Will need seed data or manual testing.
- **Cost**: ACA consumption + Cosmos serverless + SignalR Standard in new RG. Delete RG when not testing to avoid ongoing cost.
- **In-memory caches**: `fastestAnswerTracker` and `questionDeliveryTracker` are module-level caches. Each container replica gets its own — same behavior as current SWA Functions scaling.

---

## Merge Path (future, not in this plan)

When the ACA deployment is validated on the feature branch:
1. Merge `feature/containerisation` → `main`
2. Update `deploy.yml` to use ACA workflow (or rename `deploy-aca.yml` to `deploy.yml`)
3. Remove SWA-specific files (`staticwebapp.config.json`, `infra/modules/staticWebApp.bicep`)
4. Delete `rg-fastestfinger-aca-dev` (test RG)
5. Deploy to `rg-fastestfinger-dev` with container apps
6. Delete old SWA resources
