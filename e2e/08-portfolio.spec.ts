import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, addLineItem, saveAndGoHome } from './helpers';

test.describe('Portfolio', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await addLineItem(page, 'Index Fund', '500000');
    await saveAndGoHome(page);
    await page.goto('/portfolio');
    await page.waitForSelector('.portfolio-page');
  });

  test('portfolio page loads', async ({ page }) => {
    await expect(page.locator('.portfolio-page')).toBeVisible();
  });

  test('shows the holdings table with the added asset', async ({ page }) => {
    await expect(page.locator('.holdings-table').first()).toBeVisible();
    await expect(page.locator('.holdings-table').first()).toContainText('Index Fund');
  });

  test('scope toggle is present on the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scope-btn').first()).toBeVisible();
  });
});
