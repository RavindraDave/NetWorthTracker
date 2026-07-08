import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, addLineItem, saveAndGoHome, setSnapshotMonth, monthOffset, openSnapshotEditor } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await addLineItem(page, 'Savings', '1000000');
    await saveAndGoHome(page);
  });

  test('shows net worth hero with amount', async ({ page }) => {
    await expect(page.locator('.hero-num')).toBeVisible();
    await expect(page.locator('.hero-num')).toContainText('10,00,000');
  });

  test('shows three metric tiles', async ({ page }) => {
    await expect(page.locator('.metric-tile')).toHaveCount(3);
  });

  test('shows trend chart card', async ({ page }) => {
    await expect(page.locator('.chart-trend')).toBeVisible();
  });

  test('shows asset allocation donut', async ({ page }) => {
    await expect(page.locator('.chart-donut')).toBeVisible();
  });

  test('shows monthly performance card', async ({ page }) => {
    await expect(page.locator('.section-label:has-text("Monthly Performance")')).toBeVisible();
  });

  test('shows monthly cash flow card with empty-state guidance', async ({ page }) => {
    // No income/expenses recorded → the card explains how to get data in
    await expect(page.locator('.section-label:has-text("Monthly Cash Flow")')).toBeVisible();
    await expect(page.getByText('Add monthly income & expenses')).toBeVisible();
  });

  test('cash flow card charts data once income and expenses are recorded', async ({ page }) => {
    await openSnapshotEditor(page);
    await page.locator('input[aria-label^="Monthly income"]').fill('200000');
    await page.locator('input[aria-label^="Monthly expenses"]').fill('120000');
    await page.keyboard.press('Tab');
    await saveAndGoHome(page);
    await expect(page.locator('.cashflow-chart')).toBeVisible();
    await expect(page.locator('.cashflow-legend')).toContainText('Savings rate');
  });

  test('sidebar Snapshot Editor action opens the editor via the month picker', async ({ page }) => {
    await openSnapshotEditor(page);
    await expect(page.locator('.editor-page')).toBeVisible();
  });

  test('scope toggle switches views', async ({ page }) => {
    const buttons = page.locator('.scope-btn');
    await expect(buttons).toHaveCount(3);
    await buttons.nth(1).click(); // Liquid
    await expect(buttons.nth(1)).toHaveClass(/scope-active/);
  });

  test('missing-snapshot banner offers to create the current month', async ({ page }) => {
    // Re-seed with a past-month snapshot so the current month is missing
    await clearAppData(page);
    await createFirstSnapshot(page);
    await setSnapshotMonth(page, monthOffset(2));
    await addLineItem(page, 'Old Savings', '500000');
    await saveAndGoHome(page);

    const createBtn = page.getByRole('button', { name: 'Create snapshot' });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await page.waitForURL('**/editor/**');
    await expect(page.locator('input[aria-label="Snapshot month"]')).toHaveValue(monthOffset(0));
  });

  test('mobile tab bar is visible on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('.mob-tab')).toBeVisible();
  });
});
