import { test, expect, Page } from '@playwright/test';

const SCREENSHOTS_DIR = 'e2e/screenshots';

/** Helper: clear localStorage so we start fresh */
async function clearAppStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('ff_userId');
    localStorage.removeItem('ff_email');
    localStorage.removeItem('ff_displayName');
    localStorage.removeItem('theme');
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

// =============================================================
// Test 8: Dark/Light Theme Toggle
// =============================================================
test('Test 8: Dark/Light theme toggle', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  const testEmail = `e2e-theme-${Date.now()}@test.com`;
  await loginAs(page, testEmail, 'Theme Tester');
  await waitForAppShell(page);

  // Screenshot: initial theme state
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-default-theme.png`, fullPage: true });

  // Detect current theme from the toggle button title
  // In dark mode: title="Switch to light mode" (Sun icon shown)
  // In light mode: title="Switch to dark mode" (Moon icon shown)
  const switchToLightBtn = page.locator('button[title="Switch to light mode"]');
  const switchToDarkBtn = page.locator('button[title="Switch to dark mode"]');

  // One of them must be visible
  const lightBtnVisible = await switchToLightBtn.isVisible({ timeout: 5000 }).catch(() => false);
  const darkBtnVisible = await switchToDarkBtn.isVisible({ timeout: 2000 }).catch(() => false);
  expect(lightBtnVisible || darkBtnVisible).toBe(true);

  // Toggle the theme
  if (lightBtnVisible) {
    // Currently dark → switch to light
    await switchToLightBtn.click();
  } else {
    // Currently light → switch to dark
    await switchToDarkBtn.click();
  }
  await page.waitForTimeout(500);

  // Screenshot: toggled theme
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-light-theme.png`, fullPage: true });

  // After toggling, the OTHER button should now be visible
  if (lightBtnVisible) {
    await expect(switchToDarkBtn).toBeVisible({ timeout: 5000 });
  } else {
    await expect(switchToLightBtn).toBeVisible({ timeout: 5000 });
  }

  // Verify CSS custom property changed (background color changes between themes)
  const bgColorAfterToggle = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim()
  );

  // Toggle back to original theme
  if (lightBtnVisible) {
    await switchToDarkBtn.click();
  } else {
    await switchToLightBtn.click();
  }
  await page.waitForTimeout(500);

  // Screenshot: original theme restored
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-dark-theme-restored.png`, fullPage: true });

  // Verify we're back to original state
  if (lightBtnVisible) {
    await expect(switchToLightBtn).toBeVisible({ timeout: 5000 });
  } else {
    await expect(switchToDarkBtn).toBeVisible({ timeout: 5000 });
  }

  // Verify background color changed back (different from toggled state)
  const bgColorRestored = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim()
  );
  expect(bgColorRestored).not.toBe(bgColorAfterToggle);
});

// =============================================================
// Test 9: Quiz Complete — No Replay (Admin-Started Quiz)
// =============================================================
test('Test 9: Quiz complete shows waiting state (no Play Again)', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Login as admin
  await loginAs(page, 'brencampbell@microsoft.com', 'Brenda');
  await waitForAppShell(page);

  // Go to Admin tab
  const adminTab = page.locator('button', { hasText: 'Admin' });
  await expect(adminTab).toBeVisible({ timeout: 10000 });
  await adminTab.click();
  await page.waitForTimeout(3000);

  // If quiz is already live, stop it first so we have a clean start
  const stopBtn = page.getByText('Stop Quiz', { exact: false });
  if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await stopBtn.click();
    await page.waitForTimeout(2000);
  }

  // Start the quiz
  const startBtn = page.getByText('Start Quiz', { exact: false });
  await expect(startBtn).toBeVisible({ timeout: 10000 });
  await startBtn.click();
  await page.waitForTimeout(3000);

  // Switch to Quiz tab (exact match to avoid matching "Stop Quiz" button)
  const quizTab = page.getByRole('button', { name: 'Quiz', exact: true });
  await quizTab.click();
  await page.waitForTimeout(3000);

  // Answer all questions — click the first answer option for each question
  // The quiz presents questions sequentially; answer each one
  for (let q = 0; q < 10; q++) {
    // Check if we've reached the done screen
    const doneHeading = page.getByText('Quiz Complete!');
    const roundComplete = page.getByText('Round Complete!');
    if (await doneHeading.isVisible({ timeout: 500 }).catch(() => false)) break;
    if (await roundComplete.isVisible({ timeout: 500 }).catch(() => false)) break;

    // Try to find an answer button to click
    const answerButtons = page.locator('[data-testid^="answer-"], .grid button, [class*="answer"]');
    const firstAnswer = answerButtons.first();
    if (await firstAnswer.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstAnswer.click();
      // Wait for feedback and auto-advance
      await page.waitForTimeout(3000);
    } else {
      break;
    }
  }

  // Wait for done screen to appear
  await page.waitForTimeout(2000);

  // Screenshot: quiz complete
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/14-quiz-complete.png`, fullPage: true });

  // Verify "Quiz Complete!" or "Round Complete!" is showing
  const quizComplete = page.getByText('Quiz Complete!');
  const roundComplete = page.getByText('Round Complete!');
  await expect(quizComplete.or(roundComplete)).toBeVisible({ timeout: 10000 });

  // If admin-started quiz, should show waiting message and NO "Play Again"
  const waitingMsg = page.getByText(/waiting for/i);
  const playAgainBtn = page.getByText('Play Again');

  // Check for the admin-started quiz done screen features
  if (await quizComplete.isVisible({ timeout: 1000 }).catch(() => false)) {
    // Admin-started: "Quiz Complete!" + waiting text, no Play Again
    await expect(waitingMsg).toBeVisible({ timeout: 5000 });
    await expect(playAgainBtn).not.toBeVisible({ timeout: 3000 });
  }
  // If RoundComplete showed instead (free play), that's still valid but different

  // Go back to Admin and stop the quiz
  await adminTab.click();
  await page.waitForTimeout(2000);
  const stopBtnFinal = page.getByText('Stop Quiz', { exact: false });
  if (await stopBtnFinal.isVisible({ timeout: 3000 }).catch(() => false)) {
    await stopBtnFinal.click();
    await page.waitForTimeout(2000);
  }
});

// =============================================================
// Test 10: Configurable Question Count in Admin
// =============================================================
test('Test 10: Configurable question count selector', async ({ page }) => {
  await page.goto('/');
  await clearAppStorage(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Login as admin
  await loginAs(page, 'brencampbell@microsoft.com', 'Brenda');
  await waitForAppShell(page);

  // Go to Admin tab
  const adminTab = page.locator('button', { hasText: 'Admin' });
  await expect(adminTab).toBeVisible({ timeout: 10000 });
  await adminTab.click();
  await page.waitForTimeout(4000);

  // Wait for quiz status text to confirm Admin panel loaded
  await expect(page.getByText(/quiz is/i)).toBeVisible({ timeout: 15000 });

  // If quiz is running, stop it — the question count selector only shows when stopped
  const quizLiveText = page.getByText('LIVE');
  if (await quizLiveText.isVisible({ timeout: 2000 }).catch(() => false)) {
    const stopBtn = page.getByRole('button', { name: /stop quiz/i });
    await stopBtn.click();
    await page.waitForTimeout(3000);
    // Wait for "STOPPED" to confirm quiz is stopped
    await expect(page.getByText('STOPPED')).toBeVisible({ timeout: 10000 });
  }

  // Now verify the question count selector is visible
  const questionCountSelect = page.locator('#qcount');
  await expect(questionCountSelect).toBeVisible({ timeout: 10000 });

  // Verify the "Questions:" label is visible
  const questionsLabel = page.locator('label[for="qcount"]');
  await expect(questionsLabel).toBeVisible({ timeout: 5000 });

  // Screenshot: question count selector
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/15-question-count-selector.png`, fullPage: true });

  // Verify the selector has options (1-20)
  const options = await questionCountSelect.locator('option').count();
  expect(options).toBe(20);

  // Verify we can change the value
  await questionCountSelect.selectOption('5');
  const selectedValue = await questionCountSelect.inputValue();
  expect(selectedValue).toBe('5');
});
