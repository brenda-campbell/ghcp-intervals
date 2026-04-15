# ⚡ Fastest Finger Quiz

A competitive speed-trivia game where players race to answer Azure and GitHub Copilot questions. The fastest correct answer wins — points accumulate across sessions, and a real-time leaderboard fuels the rivalry.

![Azure](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoftazure)
![Functions](https://img.shields.io/badge/Azure-Functions_v4-0062AD?logo=azurefunctions)
![Cosmos DB](https://img.shields.io/badge/Azure-Cosmos_DB-0078D4?logo=azurecosmosdb)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

## How It Works

1. **Open the game link** — a round of 1–3 Azure/Copilot questions loads
2. **Timer starts immediately** — answer as fast as you can
3. **Get instant feedback** — correct answer reveal, points awarded with speed bonus
4. **Leaderboard updates in real-time** — see where you rank via SignalR

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌───────────────┐
│  Static Web App │────▶│  Azure Functions v4   │────▶│   Cosmos DB   │
│  React 19 + Vite│     │  (HTTP triggers)      │     │  (Serverless) │
│  Tailwind CSS v4│     │                       │     │               │
│  shadcn/ui      │     │  GET  /api/questions   │     │  users        │
│  SignalR client │     │  POST /api/answer      │     │  questions    │
│                 │     │  POST /api/user        │     └───────────────┘
│                 │     │  GET  /api/user/:id    │
│                 │     │  GET  /api/leaderboard │     ┌───────────────┐
│                 │◀───▶│  POST /api/negotiate   │────▶│ SignalR Service│
│                 │     │                       │     │  (Serverless)  │
└─────────────────┘     └──────────────────────┘     └───────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, TypeScript, Tailwind CSS v4, shadcn/ui, Phosphor Icons |
| **Backend** | Azure Functions v4 (Node.js/TypeScript) |
| **Database** | Azure Cosmos DB (serverless) |
| **Real-time** | Azure SignalR Service (serverless) |
| **Hosting** | Azure Static Web Apps (Free tier) |
| **IaC** | Bicep (modular: SWA + Cosmos DB + SignalR) |
| **CI/CD** | GitHub Actions (OIDC auth, single workflow) |
| **Testing** | Vitest, Testing Library (162 tests) |

## Project Structure

```
├── .github/workflows/
│   └── deploy.yml              # CI/CD: infra → build → test → deploy
├── docs/
│   └── PRD.md                  # Product requirements document
├── infra/
│   ├── main.bicep              # Orchestrator (all Azure resources)
│   ├── main.bicepparam         # Environment parameters
│   └── modules/
│       ├── staticWebApp.bicep  # SWA resource
│       ├── cosmosDb.bicep      # Cosmos DB + containers
│       └── signalr.bicep       # SignalR Service
├── src/
│   ├── api/                    # Azure Functions backend
│   │   └── src/
│   │       ├── functions/      # API endpoints
│   │       ├── models/         # TypeScript interfaces
│   │       ├── services/       # Cosmos, scoring, leaderboard, SignalR
│   │       └── scripts/        # Seed questions script
│   └── frontend/               # React SPA
│       └── src/
│           ├── components/     # UI components (quiz, timer, leaderboard)
│           ├── contexts/       # UserContext, SignalRContext
│           ├── hooks/          # useTimer, useSignalR
│           ├── services/       # API client
│           └── test/           # Component + integration tests
└── staticwebapp.config.json    # SWA routing config
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)

### Local Development

```bash
# Clone the repo
git clone https://github.com/brenda-campbell/ghcp-intervals.git
cd ghcp-intervals

# Backend
cd src/api
npm install
npm run build
npm start                     # Runs on http://localhost:7071

# Frontend (new terminal)
cd src/frontend
npm install
npm run dev                   # Runs on http://localhost:5173
```

### Seed Questions

Populate the database with 28 Azure/Copilot quiz questions:

```bash
cd src/api
# Set your Cosmos DB connection string
export CosmosDBConnectionString="your-connection-string"
npm run seed
```

### Run Tests

```bash
# Backend (76 tests)
cd src/api && npm test

# Frontend (86 tests)
cd src/frontend && npm test
```

## Deployment

### Azure Resources (IaC)

Infrastructure is defined in Bicep and deployed via GitHub Actions:

```bash
# Manual deployment (if needed)
az deployment group create \
  --resource-group rg-fastestfinger-dev \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

### GitHub Actions CI/CD

The workflow (`.github/workflows/deploy.yml`) runs on push to `main`:

1. **Infra job** — Deploys Bicep templates (OIDC auth)
2. **Build & Test job** — Installs, builds, tests both frontend and backend
3. **Deploy job** — Publishes to Azure Static Web Apps

#### Required Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | App registration client ID (OIDC) |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Target Azure subscription |
| `AZURE_RG` | Resource group name |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deployment token |

#### OIDC Setup

1. Create an App Registration in Azure AD
2. Add a Federated Credential (subject: `repo:brenda-campbell/ghcp-intervals:ref:refs/heads/main`)
3. Grant Contributor role on the resource group
4. Store IDs as GitHub repository secrets

## Game Features

- **🎯 Quiz Flow** — 1–3 questions per round, 2×2 answer grid, progress tracking
- **⏱️ Precision Timer** — `requestAnimationFrame`-based, color-coded (green → amber → red)
- **📊 Live Leaderboard** — Top 10 with gold/silver/bronze badges, real-time SignalR updates
- **🔒 Anti-Cheat** — Server-authoritative timing, correct answers never sent to client
- **👤 Anonymous Identity** — Auto-generated profiles, localStorage persistence
- **✨ Animations** — Answer feedback, page transitions, score counter, confetti on perfect rounds
- **📱 Mobile Responsive** — Touch-optimized, safe areas, fluid typography

## Design System

| Token | Value |
|-------|-------|
| Azure Blue | `#4A90E2` |
| Deep Space Gray | `#2A2D3A` |
| GitHub Black | `#1B1D23` |
| Electric Lime | `#C5F542` |
| Headings | Space Grotesk |
| Code / Scores | JetBrains Mono |

## Scoring

- **Correct answer**: 100 base points
- **Speed bonus**: Up to 100 additional points (inversely scaled with response time)
- **Ties broken by**: Fastest cumulative response time

## License

MIT
