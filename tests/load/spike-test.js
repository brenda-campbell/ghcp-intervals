/**
 * Spike Test — sudden surge to 100 users, then drop back
 * Run: k6 run spike-test.js -e BASE_URL=https://your-app.azurestaticapps.net
 *
 * Simulates a quiz event where all participants join at the same time
 * (e.g., presenter says "go" and 100 people click login simultaneously).
 *
 * This stresses the login endpoint and Cosmos DB write path specifically.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const spikeErrors = new Rate('spike_errors');

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },   // Warm-up: 10 users
        { duration: '5s', target: 100 },   // Spike: jump to 100 users
        { duration: '1m', target: 100 },   // Hold the spike
        { duration: '10s', target: 10 },   // Scale back
        { duration: '30s', target: 10 },   // Recovery hold
        { duration: '10s', target: 0 },    // Done
      ],
    },
  },

  thresholds: {
    http_req_failed: ['rate<0.05'],          // Allow up to 5% errors during spike
    'http_req_duration{name:login}': ['p(99)<2000'],  // Login can be slower under spike
    spike_errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:7071';

export default function () {
  const email = `spike-user-${__VU}-${__ITER}@loadtest.internal`;
  const displayName = `Spike User ${__VU}`;

  // Focus on the login+heartbeat path (most likely bottleneck during event start)
  const loginRes = http.post(
    `${BASE_URL}/api/users/login-or-create`,
    JSON.stringify({ email, displayName }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } }
  );

  const ok = check(loginRes, {
    'spike login: status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'spike login: not throttled': (r) => r.status !== 429,
  });
  spikeErrors.add(!ok);

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    sleep(1);
    return;
  }

  const userId = JSON.parse(loginRes.body).id;
  const headers = { 'Content-Type': 'application/json', 'x-user-id': userId };

  sleep(0.5);

  // Poll game state (all 100 users polling simultaneously)
  const stateRes = http.get(`${BASE_URL}/api/game/state`, { tags: { name: 'game_state' } });
  check(stateRes, { 'game state: ok': (r) => r.status === 200 });

  sleep(0.5);

  // SignalR — all users negotiating at once
  const negotiateRes = http.post(`${BASE_URL}/api/negotiate`, null, {
    headers,
    tags: { name: 'negotiate' },
  });
  check(negotiateRes, { 'negotiate: ok': (r) => r.status === 200 || r.status === 201 });

  sleep(2);

  // Heartbeat — simulating active presence
  http.post(
    `${BASE_URL}/api/game/heartbeat`,
    JSON.stringify({ userId, displayName }),
    { headers, tags: { name: 'heartbeat' } }
  );

  sleep(3);
}
