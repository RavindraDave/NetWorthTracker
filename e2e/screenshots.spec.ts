import { test } from '@playwright/test';
import { clearAppData, createFirstSnapshot, addLineItem, saveAndGoHome, setSnapshotMonth, monthOffset } from './helpers';

/**
 * Documentation tooling, not a test gate: regenerates the user-guide
 * screenshots in docs/screenshots/. Run on demand with
 *   SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
 * Skipped by default so the CI/verification run stays fast and doesn't
 * churn binary files.
 */
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to regenerate docs screenshots');

const SS = (name: string) => `docs/screenshots/${name}.png`;

/** Seed a past + current month with items and cash flow so charts show a healthy story. */
async function seedTwoMonths(page: import('@playwright/test').Page) {
  await clearAppData(page);
  await createFirstSnapshot(page);
  await setSnapshotMonth(page, monthOffset(1));
  await addLineItem(page, 'Savings Account', '500000');
  await addLineItem(page, 'Index Funds', '1200000');
  await page.locator('input[aria-label^="Monthly income"]').fill('200000');
  await page.locator('input[aria-label^="Monthly expenses"]').fill('120000');
  await page.keyboard.press('Tab');
  await saveAndGoHome(page);
  // The banner creates a blank snapshot for the current month — populate it
  await page.getByRole('button', { name: 'Create snapshot' }).click();
  await page.waitForSelector('.editor-page');
  await addLineItem(page, 'Savings Account', '550000');
  await addLineItem(page, 'Index Funds', '1310000');
  await page.locator('input[aria-label^="Monthly income"]').fill('250000');
  await page.locator('input[aria-label^="Monthly expenses"]').fill('140000');
  await page.keyboard.press('Tab');
  await saveAndGoHome(page);
}

test.describe('Screenshots', () => {
  test('01 - welcome screen', async ({ page }) => {
    await clearAppData(page);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: SS('01-welcome'), fullPage: true });
  });

  test('02 - snapshot editor empty', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await page.screenshot({ path: SS('02-snapshot-editor-empty'), fullPage: true });
  });

  test('03 - snapshot editor with data', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await addLineItem(page, 'Savings Account', '500000');
    await addLineItem(page, 'Index Funds', '1200000');
    await page.screenshot({ path: SS('03-snapshot-editor-filled'), fullPage: true });
  });

  test('04 - dashboard', async ({ page }) => {
    await seedTwoMonths(page);
    await page.waitForTimeout(1600); // count-up + chart animations
    await page.screenshot({ path: SS('04-dashboard'), fullPage: true });
  });

  test('05 - history page', async ({ page }) => {
    await seedTwoMonths(page);
    await page.goto('/history');
    await page.waitForSelector('.hist-card');
    await page.screenshot({ path: SS('05-history'), fullPage: true });
  });

  test('06 - goals empty', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/goals');
    await page.waitForSelector('.goals-page');
    await page.screenshot({ path: SS('06-goals-empty'), fullPage: true });
  });

  test('07 - goals with FIRE goal', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await addLineItem(page, 'Index Funds', '1500000');
    await saveAndGoHome(page);
    await page.goto('/goals');
    await page.click('button:has-text("Create First Goal")');
    await page.fill('#goal-name', 'Early Retirement');
    await page.fill('#goal-expenses', '1200000');
    await page.click('button:has-text("Save Goal")');
    await page.waitForSelector('.fire-dashboard');
    await page.waitForTimeout(500);
    await page.screenshot({ path: SS('07-goals-fire'), fullPage: true });
  });

  test('08 - portfolio page', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await addLineItem(page, 'Nifty 50 Index', '1200000');
    await saveAndGoHome(page);
    await page.goto('/portfolio');
    await page.waitForSelector('.portfolio-page');
    await page.screenshot({ path: SS('08-portfolio'), fullPage: true });
  });

  test('09 - settings page', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/settings');
    await page.waitForSelector('.settings-page');
    await page.screenshot({ path: SS('09-settings'), fullPage: true });
  });

  test('10 - settings data & backup', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/settings');
    await page.waitForSelector('.settings-page');
    await page.locator('.settings-nav-btn:has-text("Data & Backup")').click();
    await page.locator('h2:has-text("Data & Backup")').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS('10-settings-data'), fullPage: false });
  });

  test('11 - mobile dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await clearAppData(page);
    await createFirstSnapshot(page);
    await addLineItem(page, 'Index Funds', '1500000');
    await saveAndGoHome(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: SS('11-mobile-dashboard'), fullPage: true });
  });

  test('12 - mobile nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS('12-mobile-nav'), fullPage: false });
  });

  test('13 - light mode dashboard', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await addLineItem(page, 'Index Funds', '1500000');
    await saveAndGoHome(page);
    await page.goto('/settings');
    await page.locator('.theme-toggle-btn:has-text("Light")').click();
    await page.goto('/');
    await page.waitForTimeout(800);
    await page.screenshot({ path: SS('13-light-mode'), fullPage: true });
  });

  test('14 - history compare', async ({ page }) => {
    await seedTwoMonths(page);
    await page.goto('/history');
    await page.waitForSelector('.hist-card');
    const selects = page.locator('.hist-select');
    await selects.first().selectOption({ index: 1 });
    await selects.last().selectOption({ index: 2 });
    await page.click('button:has-text("Compare")');
    await page.waitForSelector('.compare-modal');
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS('14-history-compare'), fullPage: true });
  });
});
