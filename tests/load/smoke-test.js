/**
 * Smoke Test — sanity check before running full load tests
 * Run: k6 run smoke-test.js -e BASE_URL=https://your-app.azurestaticapps.net
 *
 * Simulates 3 users doing a complete quiz session.
 * All checks must pass (0 failures) before running stress-test.js.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 3,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate==0'],        // Zero failures required
    http_req_duration: ['p(95)<1000'],   // All requests under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:7071';

export default function () {
  const userIndex = __VU;
  const email = `smoke-user-${userIndex}@loadtest.internal`;
  const displayName = `Smoke User ${userIndex}`;

  // --- Login ---
  const loginRes = http.post(
    `${BASE_URL}/api/users/login-or-create`,
    JSON.stringify({ email, displayName }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } }
  );

  check(loginRes, {
    'login: status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login: returns userId': (r) => {
      try { return JSON.parse(r.body)?.id !== undefined; } catch { return false; }
    },
  });

  if (loginRes.status !== 200 && loginRes.status !== 201) return;
  const userId = JSON.parse(loginRes.body).id;
  const headers = { 'Content-Type': 'application/json', 'x-user-id': userId };

  sleep(1);

  // --- Game state ---
  const stateRes = http.get(`${BASE_URL}/api/game/state`, { tags: { name: 'game_state' } });
  check(stateRes, { 'game state: status 200': (r) => r.status === 200 });

  sleep(0.5);

  // --- SignalR negotiation ---
  const negotiateRes = http.post(`${BASE_URL}/api/negotiate`, null, {
    headers,
    tags: { name: 'negotiate' },
  });
  check(negotiateRes, { 'negotiate: status ok': (r) => r.status === 200 || r.status === 201 });

  sleep(0.5);

  // --- Questions ---
  const questionsRes = http.get(`${BASE_URL}/api/questions`, { tags: { name: 'questions' } });
  check(questionsRes, { 'questions: status 200': (r) => r.status === 200 });

  sleep(1);

  // --- Leaderboard ---
  const leaderboardRes = http.get(`${BASE_URL}/api/leaderboard`, { tags: { name: 'leaderboard' } });
  check(leaderboardRes, { 'leaderboard: status 200': (r) => r.status === 200 });

  sleep(1);

  // --- Heartbeat ---
  const heartbeatRes = http.post(
    `${BASE_URL}/api/game/heartbeat`,
    JSON.stringify({ userId, displayName }),
    { headers, tags: { name: 'heartbeat' } }
  );
  check(heartbeatRes, { 'heartbeat: status 200': (r) => r.status === 200 });

  sleep(2);
}
