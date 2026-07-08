import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
  });

  test('can navigate to Portfolio', async ({ page }) => {
    await page.goto('/portfolio');
    await expect(page.locator('.portfolio-page')).toBeVisible();
  });

  test('can navigate to History', async ({ page }) => {
    await page.goto('/history');
    await expect(page.locator('.history-page')).toBeVisible();
  });

  test('can navigate to Goals', async ({ page }) => {
    await page.goto('/goals');
    await expect(page.locator('.goals-page')).toBeVisible();
  });

  test('can navigate to Settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.settings-page')).toBeVisible();
  });

  test('sidebar links move between pages', async ({ page }) => {
    await page.locator('a[href="/portfolio"]').first().click();
    await expect(page.locator('.portfolio-page')).toBeVisible();
    await page.locator('a[href="/"]').first().click();
    await expect(page.locator('.dashboard-page')).toBeVisible();
  });

  test('mobile tab bar shows 5 buttons', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('.mob-tab-btn')).toHaveCount(5);
  });

  test('mobile Settings tab works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('.mob-tab-btn:has-text("Settings")').click();
    await expect(page.locator('.settings-page')).toBeVisible();
  });
});
