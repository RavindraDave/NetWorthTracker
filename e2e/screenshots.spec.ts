import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';
import path from 'path';

const SS = (name: string) => `docs/screenshots/${name}.png`;

test.describe('Screenshots', () => {
  test('01 - welcome screen', async ({ page }) => {
    await clearAppData(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: SS('01-welcome'), fullPage: true });
  });

  test('02 - snapshot editor empty', async ({ page }) => {
    await clearAppData(page);
    await page.goto('/');
    await page.click('button:has-text("Create First Snapshot")');
    await page.waitForSelector('.snapshot-editor', { timeout: 8000 });
    await page.screenshot({ path: SS('02-snapshot-editor-empty'), fullPage: true });
  });

  test('03 - snapshot editor with data', async ({ page }) => {
    await clearAppData(page);
    await page.goto('/');
    await page.click('button:has-text("Create First Snapshot")');
    await page.waitForSelector('.snapshot-editor', { timeout: 8000 });
    // Fill in some data
    const addBtns = page.locator('.category-section__add-btn');
    await addBtns.first().click();
    await page.locator('.line-item-input.name-input').last().fill('Savings Account');
    await page.locator('.line-item-input.amount-input').last().fill('500000');
    await addBtns.first().click();
    await page.locator('.line-item-input.name-input').last().fill('Index Funds');
    await page.locator('.line-item-input.amount-input').last().fill('1200000');
    // Add a liability
    await addBtns.last().click();
    await page.locator('.line-item-input.name-input').last().fill('Home Loan');
    await page.locator('.line-item-input.amount-input').last().fill('2500000');
    await page.screenshot({ path: SS('03-snapshot-editor-filled'), fullPage: true });
  });

  test('04 - dashboard', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    // Add meaningful data
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.name-input').last().fill('Savings Account');
    await page.locator('.line-item-input.amount-input').last().fill('500000');
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.name-input').last().fill('Index Funds');
    await page.locator('.line-item-input.amount-input').last().fill('1200000');
    await saveAndGoHome(page);
    // Create second month for charts
    await page.click('button:has-text("New Month")');
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('600000');
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('1300000');
    await saveAndGoHome(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: SS('04-dashboard'), fullPage: true });
  });

  test('05 - history page', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('500000');
    await saveAndGoHome(page);
    await page.click('button:has-text("New Month")');
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('600000');
    await saveAndGoHome(page);
    await page.goto('/history');
    await page.waitForSelector('.history-card');
    await page.screenshot({ path: SS('05-history'), fullPage: true });
  });

  test('06 - goals empty', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/goals');
    await page.waitForSelector('.goals-page, .goals');
    await page.screenshot({ path: SS('06-goals-empty'), fullPage: true });
  });

  test('07 - goals with FIRE goal', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('1500000');
    await saveAndGoHome(page);
    await page.goto('/goals');
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
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
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.name-input').last().fill('Nifty 50 Index');
    await page.locator('.line-item-input.amount-input').last().fill('1200000');
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

  test('10 - settings data management', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/settings');
    await page.waitForSelector('.settings-page');
    // Scroll to data management section
    await page.locator('h2:has-text("Data Management")').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS('10-settings-data'), fullPage: false });
  });

  test('11 - mobile dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await clearAppData(page);
    await createFirstSnapshot(page);
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('1500000');
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
    // Scroll to bottom to show mobile nav
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS('12-mobile-nav'), fullPage: false });
  });

  test('13 - light mode dashboard', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('1500000');
    await saveAndGoHome(page);
    // Switch to light mode
    await page.goto('/settings');
    await page.click('button:has-text("Light")');
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.screenshot({ path: SS('13-light-mode'), fullPage: true });
  });

  test('14 - history compare', async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('500000');
    await saveAndGoHome(page);
    await page.click('button:has-text("New Month")');
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('700000');
    await saveAndGoHome(page);
    await page.goto('/history');
    await page.waitForSelector('.history-card');
    // Try to select checkboxes for compare
    const checkboxes = page.locator('.history-compare-group input[type="checkbox"], .compare-checkbox');
    if (await checkboxes.count() >= 2) {
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: SS('14-history-compare'), fullPage: true });
  });
});
