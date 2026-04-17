import { test, expect, Page } from '@playwright/test';

const SCREENSHOTS_DIR = 'e2e/screenshots';

/** Helper: clear localStorage so we start fresh */
async function clearAppStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('ff_userId');
    localStorage.removeItem('ff_email');
    localStorage.removeItem('ff_displayName');
  });
}

/** Helper: perform login via EmailEntry form */
async function loginAs(page: Page, email: string, displayName: string) {
  const emailInput = page.locator('#email');
  const nameInput = page.locator('#displayName');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);
  await nameInput.fill(displayName);
  // Click the "Enter the Game" submit button
  await page.locator('button[type="submit"]').click();
}

/** Helper: wait for the main app shell to appear after login */
async function waitForAppShell(page: Page) {
  // The app shell has "Fastest Finger" heading and tab buttons
  await expect(page.locator('h1')).toContainText('Fastest Finger', { timeout: 15000 });
  await expect(page.locator('button', { hasText: 'Quiz' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('button', { hasText: 'Leaderboard' })).toBeVisible({ timeout: 10000 });
}

/** Helper: capture page HTML on failure for debugging */
async function captureDebugInfo(page: Page, label: string) {
  try {
    const html = await page.content();
    const truncated = html.substring(0, 3000);
    console.log(`\n--- DEBUG [${label}] page HTML (first 3000 chars) ---\n${truncated}\n---`);
  } catch { /* ignore */ }
}

// =============================================================
// Test 1: Fresh Login Flow
// =============================================================
test('Test 1: Fresh login flow', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Screenshot: landing page
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-landing-page.png`, fullPage: true });

  // Verify login form is visible
  const heading = page.locator('h1');
  await expect(heading).toContainText('Fastest Finger', { timeout: 10000 });
  const emailInput = page.locator('#email');
  await expect(emailInput).toBeVisible({ timeout: 10000 });

  // Login with unique test email
  const testEmail = `e2e-test-${Date.now()}@test.com`;
  await loginAs(page, testEmail, 'E2E Tester');

  // Wait for app shell
  try {
    await waitForAppShell(page);
  } catch (e) {
    await captureDebugInfo(page, 'after-login');
    throw e;
  }

  // Screenshot: after login
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-after-login.png`, fullPage: true });

  // Verify header and tabs
  await expect(page.locator('h1')).toContainText('Fastest Finger');
  await expect(page.locator('button', { hasText: 'Quiz' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'Leaderboard' })).toBeVisible();

  // No error messages visible
  const errorBanners = page.locator('.text-destructive');
  const errorCount = await errorBanners.count();
  // If any error text is visible, fail
  for (let i = 0; i < errorCount; i++) {
    const visible = await errorBanners.nth(i).isVisible();
    if (visible) {
      const text = await errorBanners.nth(i).textContent();
      // Tolerate non-error uses of destructive class (e.g. signout button hover)
      if (text && (text.includes('error') || text.includes('Error') || text.includes('API'))) {
        throw new Error(`Unexpected error visible after login: "${text}"`);
      }
    }
  }
});

// =============================================================
// Test 2: Quiz Tab (Waiting Room)
// =============================================================
test('Test 2: Quiz tab shows waiting room or questions', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  const testEmail = `e2e-quiz-${Date.now()}@test.com`;
  await loginAs(page, testEmail, 'Quiz Tester');

  try {
    await waitForAppShell(page);
  } catch (e) {
    await captureDebugInfo(page, 'quiz-login');
    throw e;
  }

  // Quiz tab should be selected by default — look for quiz-related content
  // Either WaitingScreen ("Waiting for quiz to start") or QuestionPage
  const waitingText = page.locator('text=Waiting for quiz to start');
  const questionContent = page.locator('text=Question');

  // Wait for either to appear
  await expect(
    waitingText.or(questionContent)
  ).toBeVisible({ timeout: 15000 });

  // Screenshot: quiz tab
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-quiz-tab.png`, fullPage: true });

  // Verify the page is not blank — some meaningful content is visible
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(50);
});

// =============================================================
// Test 3: Leaderboard Tab
// =============================================================
test('Test 3: Leaderboard tab loads', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  const testEmail = `e2e-lb-${Date.now()}@test.com`;
  await loginAs(page, testEmail, 'LB Tester');

  try {
    await waitForAppShell(page);
  } catch (e) {
    await captureDebugInfo(page, 'lb-login');
    throw e;
  }

  // Click Leaderboard tab
  await page.locator('button', { hasText: 'Leaderboard' }).click();

  // Wait for leaderboard content to load
  // Could show a table, "no scores" message, or loading skeleton
  await page.waitForTimeout(3000);

  // Screenshot: leaderboard
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-leaderboard.png`, fullPage: true });

  // Verify leaderboard section is visible — look for the heading specifically
  const leaderboardHeading = page.getByRole('heading', { name: 'Leaderboard' });
  await expect(leaderboardHeading).toBeVisible({ timeout: 10000 });

  // Verify the table rendered with data or shows empty state
  const leaderboardTable = page.locator('table').first();
  await expect(leaderboardTable).toBeVisible({ timeout: 10000 });
});

// =============================================================
// Test 4: Admin Login Flow
// =============================================================
test('Test 4: Admin login shows Admin tab', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Login as admin
  await loginAs(page, 'brencampbell@microsoft.com', 'Brenda');

  try {
    await waitForAppShell(page);
  } catch (e) {
    await captureDebugInfo(page, 'admin-login');
    throw e;
  }

  // Screenshot: admin login
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-admin-login.png`, fullPage: true });

  // Verify Admin tab is visible (3 tabs)
  const adminTab = page.locator('button', { hasText: 'Admin' });
  await expect(adminTab).toBeVisible({ timeout: 10000 });

  // Click Admin tab
  await adminTab.click();

  // Wait for admin panel content to load
  await page.waitForTimeout(3000);

  // Look for Quiz Control section or other admin markers
  const quizControl = page.getByText(/quiz control/i);
  const adminHeading = page.getByText(/admin/i);
  try {
    await expect(quizControl.or(adminHeading)).toBeVisible({ timeout: 10000 });
  } catch (e) {
    await captureDebugInfo(page, 'admin-panel');
    throw e;
  }

  // Screenshot: admin panel
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-admin-panel.png`, fullPage: true });

  // Verify not blank — admin panel has meaningful content
  const panelText = await page.locator('body').innerText();
  expect(panelText.length).toBeGreaterThan(100);
});

// =============================================================
// Test 5: Admin Panel Sections
// =============================================================
test('Test 5: Admin panel sections render', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  await loginAs(page, 'brencampbell@microsoft.com', 'Brenda');
  await waitForAppShell(page);

  // Navigate to Admin
  await page.locator('button', { hasText: 'Admin' }).click();
  await page.waitForTimeout(4000);

  // Verify key admin sections
  // Quiz Control shows "Quiz is LIVE" or "Quiz is STOPPED" (no heading)
  const quizStatus = page.getByText(/quiz is/i);
  await expect(quizStatus).toBeVisible({ timeout: 10000 });

  // Start/Stop Quiz button
  const quizToggle = page.getByText(/start quiz|stop quiz/i);
  await expect(quizToggle).toBeVisible({ timeout: 10000 });

  // Online Players section
  const onlinePlayers = page.getByText(/online players/i);
  await expect(onlinePlayers).toBeVisible({ timeout: 10000 });

  // Category Management card
  const categoryMgmt = page.getByText(/category management/i);
  await expect(categoryMgmt).toBeVisible({ timeout: 10000 });

  // Score Management card
  const scoreMgmt = page.getByText(/score management/i);
  await expect(scoreMgmt).toBeVisible({ timeout: 10000 });

  // Screenshot: admin sections
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-admin-sections.png`, fullPage: true });
});

// =============================================================
// Test 6: Logout and Re-login
// =============================================================
test('Test 6: Logout and re-login', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  const email1 = `e2e-logout-${Date.now()}@test.com`;
  await loginAs(page, email1, 'Logout Tester');
  await waitForAppShell(page);

  // Click sign-out button (the SignOut icon button)
  const signOutBtn = page.locator('button[title="Sign out"]');
  await expect(signOutBtn).toBeVisible({ timeout: 5000 });
  await signOutBtn.click();

  // Should return to login screen
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });

  // Screenshot: after logout
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-after-logout.png`, fullPage: true });

  // Re-login with different email
  const email2 = `e2e-relogin-${Date.now()}@test.com`;
  await loginAs(page, email2, 'Relogin Tester');

  try {
    await waitForAppShell(page);
  } catch (e) {
    await captureDebugInfo(page, 're-login');
    throw e;
  }

  // Screenshot: re-login
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-re-login.png`, fullPage: true });

  // Verify logged in
  await expect(page.locator('h1')).toContainText('Fastest Finger');
});

// =============================================================
// Test 7: Return User (localStorage auto-login)
// =============================================================
test('Test 7: Return user auto-login from localStorage', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  // First login
  const email = `e2e-return-${Date.now()}@test.com`;
  await loginAs(page, email, 'Return Tester');
  await waitForAppShell(page);

  // Navigate away and come back (simulating page revisit)
  await page.goto('about:blank');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Should auto-login — either see the "Verifying account" spinner briefly, then the app shell
  try {
    await waitForAppShell(page);
  } catch (e) {
    // Check if we're stuck on "Verifying account" spinner
    const verifying = page.getByText('Verifying account');
    if (await verifying.isVisible()) {
      await captureDebugInfo(page, 'return-user-stuck');
      throw new Error('Stuck on "Verifying account" spinner — auto-login failed');
    }
    // Check for error state
    const errorCard = page.locator('.text-destructive');
    if (await errorCard.first().isVisible()) {
      const errorText = await errorCard.first().textContent();
      await captureDebugInfo(page, 'return-user-error');
      throw new Error(`Return user got error: "${errorText}"`);
    }
    throw e;
  }

  // Screenshot: return user
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-return-user.png`, fullPage: true });

  // Verify auto-logged in
  await expect(page.locator('h1')).toContainText('Fastest Finger');
  await expect(page.locator('button', { hasText: 'Quiz' })).toBeVisible();
});
