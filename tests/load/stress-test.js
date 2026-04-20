/**
 * Stress Test — 60 concurrent users, full quiz session simulation
 * Run: k6 run stress-test.js -e BASE_URL=https://your-app.azurestaticapps.net
 *
 * Stages:
 *   0→60 users over 30s  (ramp-up, like a real event starting)
 *   60 users for 3 min   (sustained load)
 *   60→0 users over 30s  (ramp-down)
 *
 * Performance thresholds (production-readiness criteria):
 *   - 95th percentile response time < 500ms
 *   - 99th percentile response time < 1s
 *   - Error rate < 1%
 *   - Answer submission p95 < 300ms (latency-sensitive)
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics
const loginDuration = new Trend('login_duration', true);
const answerDuration = new Trend('answer_duration', true);
const signalrNegotiateDuration = new Trend('signalr_negotiate_duration', true);
const loginErrors = new Rate('login_errors');
const answerErrors = new Rate('answer_errors');
const totalAnswersSubmitted = new Counter('answers_submitted');

export const options = {
  scenarios: {
    quiz_players: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 60 },  // Ramp up to 60 concurrent users
        { duration: '3m', target: 60 },   // Hold at 60 users (sustained load)
        { duration: '30s', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    // Overall thresholds
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],       // < 1% error rate

    // Per-endpoint thresholds
    'http_req_duration{name:login}': ['p(95)<500'],
    'http_req_duration{name:game_state}': ['p(95)<300'],
    'http_req_duration{name:questions}': ['p(95)<400'],
    'http_req_duration{name:answer}': ['p(95)<300'],     // Most latency-sensitive
    'http_req_duration{name:leaderboard}': ['p(95)<400'],
    'http_req_duration{name:heartbeat}': ['p(95)<200'],
    'http_req_duration{name:negotiate}': ['p(95)<600'],  // SignalR has extra overhead

    // Custom metric thresholds
    login_duration: ['p(95)<500'],
    answer_duration: ['p(95)<300'],
    login_errors: ['rate<0.01'],
    answer_errors: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:7071';

// Pre-generate 120 unique test users (2x VU count to avoid collisions across iterations)
const TEST_USERS = Array.from({ length: 120 }, (_, i) => ({
  email: `loadtest-${i}@stress.internal`,
  displayName: `Load Test User ${i}`,
}));

export default function () {
  // Each VU picks a stable user identity
  const userIndex = (__VU - 1) % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  let userId = null;

  // ─── Step 1: Login / Register ────────────────────────────────────────────
  group('login', () => {
    const start = Date.now();
    const loginRes = http.post(
      `${BASE_URL}/api/users/login-or-create`,
      JSON.stringify({ email: user.email, displayName: user.displayName }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } }
    );
    loginDuration.add(Date.now() - start);

    const loginOk = check(loginRes, {
      'login: status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'login: returns id': (r) => {
        try { return !!JSON.parse(r.body)?.id; } catch { return false; }
      },
    });

    loginErrors.add(!loginOk);

    if (!loginOk) return;
    userId = JSON.parse(loginRes.body).id;
  });

  if (!userId) return; // Abort iteration if login failed

  const headers = { 'Content-Type': 'application/json', 'x-user-id': userId };

  sleep(0.5);

  // ─── Step 2: Poll game state ──────────────────────────────────────────────
  let gameState = null;
  group('game_state', () => {
    const stateRes = http.get(`${BASE_URL}/api/game/state`, {
      tags: { name: 'game_state' },
    });
    check(stateRes, { 'game state: 200': (r) => r.status === 200 });
    try { gameState = JSON.parse(stateRes.body); } catch { /* ok */ }
  });

  sleep(0.5);

  // ─── Step 3: SignalR negotiation ──────────────────────────────────────────
  group('signalr', () => {
    const start = Date.now();
    const negotiateRes = http.post(`${BASE_URL}/api/negotiate`, null, {
      headers,
      tags: { name: 'negotiate' },
    });
    signalrNegotiateDuration.add(Date.now() - start);
    check(negotiateRes, { 'negotiate: status ok': (r) => r.status === 200 || r.status === 201 });
  });

  sleep(0.5);

  // ─── Step 4: Fetch questions ──────────────────────────────────────────────
  let questions = [];
  group('questions', () => {
    const questionsRes = http.get(`${BASE_URL}/api/questions`, {
      tags: { name: 'questions' },
    });
    check(questionsRes, { 'questions: 200': (r) => r.status === 200 });
    try { questions = JSON.parse(questionsRes.body) || []; } catch { /* ok */ }
  });

  // Simulate reading the question (think time)
  sleep(Math.random() * 3 + 2); // 2–5s read time

  // ─── Step 5: Submit answer (if quiz is active and questions exist) ─────────
  if (gameState?.isQuizActive && questions.length > 0) {
    group('answer', () => {
      const question = questions[0];
      const randomAnswer = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)];
      const timeTaken = Math.floor(Math.random() * 8000) + 1000; // 1–9s

      const start = Date.now();
      const answerRes = http.post(
        `${BASE_URL}/api/answer`,
        JSON.stringify({
          userId,
          questionId: question.id || question._id,
          answer: randomAnswer,
          timeTaken,
        }),
        { headers, tags: { name: 'answer' } }
      );
      answerDuration.add(Date.now() - start);

      const answerOk = check(answerRes, {
        'answer: accepted (200 or 400)': (r) => r.status === 200 || r.status === 400,
        'answer: not server error': (r) => r.status < 500,
      });

      answerErrors.add(!answerOk);
      if (answerOk) totalAnswersSubmitted.add(1);
    });

    sleep(1);
  }

  // ─── Step 6: Leaderboard ──────────────────────────────────────────────────
  group('leaderboard', () => {
    const leaderboardRes = http.get(`${BASE_URL}/api/leaderboard`, {
      tags: { name: 'leaderboard' },
    });
    check(leaderboardRes, { 'leaderboard: 200': (r) => r.status === 200 });
  });

  sleep(1);

  // ─── Step 7: Heartbeat ────────────────────────────────────────────────────
  group('heartbeat', () => {
    const heartbeatRes = http.post(
      `${BASE_URL}/api/game/heartbeat`,
      JSON.stringify({ userId, displayName: user.displayName }),
      { headers, tags: { name: 'heartbeat' } }
    );
    check(heartbeatRes, { 'heartbeat: 200': (r) => r.status === 200 });
  });

  // Think time before next iteration
  sleep(Math.random() * 2 + 1); // 1–3s
}
