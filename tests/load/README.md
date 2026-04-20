# Load Testing — Fastest Finger Quiz

Three k6 test scripts to validate production readiness with **60 concurrent users**.

## Prerequisites

Install [k6](https://k6.io/docs/getting-started/installation/):

```bash
# Windows (winget)
winget install k6 --source winget

# macOS
brew install k6

# Docker
docker pull grafana/k6
```

---

## Test Scripts

| Script | Users | Duration | Purpose |
|---|---|---|---|
| `smoke-test.js` | 3 | ~30s | Sanity check — run this first |
| `stress-test.js` | 60 | ~4min | Production readiness at 60 concurrent users |
| `spike-test.js` | 100 | ~2min | Event-start surge (all users joining at once) |

---

## Running the Tests

Replace `BASE_URL` with your deployed app URL (or omit for local dev on port 7071):

```bash
# 1. Smoke test first — must pass before running stress test
k6 run tests/load/smoke-test.js \
  -e BASE_URL=https://your-app.azurestaticapps.net

# 2. Stress test — 60 concurrent users
k6 run tests/load/stress-test.js \
  -e BASE_URL=https://your-app.azurestaticapps.net

# 3. Spike test — simulate all users joining at once
k6 run tests/load/spike-test.js \
  -e BASE_URL=https://your-app.azurestaticapps.net

# With HTML report output
k6 run tests/load/stress-test.js \
  -e BASE_URL=https://your-app.azurestaticapps.net \
  --out json=results/stress-$(date +%Y%m%d-%H%M%S).json
```

**Local testing** (API on port 7071, no `-e BASE_URL` needed):
```bash
# Start the API first
cd src/api && npm start

# Run tests in another terminal
k6 run tests/load/smoke-test.js
```

---

## Performance Thresholds (Pass/Fail Criteria)

The stress test enforces these thresholds — k6 exits with code 1 if any fail:

| Metric | Threshold |
|---|---|
| All endpoints p95 | < 500ms |
| All endpoints p99 | < 1000ms |
| Answer submission p95 | < 300ms |
| Heartbeat p95 | < 200ms |
| Error rate | < 1% |
| Login errors | < 1% |

---

## What Is Tested

Each virtual user simulates a complete quiz session:

1. **Login** (`POST /api/users/login-or-create`)
2. **Poll game state** (`GET /api/game/state`)
3. **SignalR negotiation** (`POST /api/negotiate`)
4. **Fetch questions** (`GET /api/questions`)
5. **Submit answer** (`POST /api/answer`) — only when quiz is active
6. **Leaderboard** (`GET /api/leaderboard`)
7. **Heartbeat** (`POST /api/game/heartbeat`)

---

## Azure Load Testing (Cloud-Scale Option)

For CI/CD integration or testing beyond what your laptop can generate, use **Azure Load Testing** — it runs k6 scripts natively:

```bash
# Install Azure Load Testing CLI extension
az extension add --name load

# Create a load test resource (one-time)
az load create \
  --name ghcp-quiz-load-test \
  --resource-group <your-rg> \
  --location eastus

# Run stress test in the cloud
az load test create \
  --load-test-resource ghcp-quiz-load-test \
  --resource-group <your-rg> \
  --test-id stress-60vu \
  --display-name "60 Concurrent Users - Stress Test" \
  --description "Production readiness validation" \
  --test-plan tests/load/stress-test.js \
  --engine-instances 1 \
  --env BASE_URL="https://your-app.azurestaticapps.net"
```

Results are available in the Azure portal with rich dashboards, server-side metrics, and integration with Azure Monitor.

---

## Interpreting Results

After a run, k6 prints a summary. Key metrics to review:

```
✓ http_req_duration.............: avg=123ms p(95)=487ms p(99)=892ms
✓ http_req_failed...............: 0.12%
✓ answer_duration...............: p(95)=245ms
✗ http_req_duration{name:login}.: p(95)=612ms  ← FAIL: over 500ms threshold
```

**If thresholds fail, investigate:**
- `login` slow → Cosmos DB write scaling; check RU/s consumption
- `negotiate` slow → SignalR service tier (Free → Standard)
- `leaderboard` slow → Cosmos DB query; add composite index on `score + category`
- `429` errors → Cosmos DB RU/s limit hit; scale up or enable autoscale
- `503` errors → Azure Functions cold starts; consider Premium plan

---

## Cleanup Test Data

After load testing, remove the synthetic users from Cosmos DB:

```bash
# Admin endpoint — removes all loadtest users (requires admin userId)
curl -X DELETE "https://your-app.azurestaticapps.net/api/users?pattern=loadtest" \
  -H "x-user-id: <your-admin-user-id>"
```

Or use the Azure portal to query and delete documents in the `users` container where `email` contains `@loadtest.internal` or `@stress.internal`.
