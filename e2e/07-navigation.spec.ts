import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
  });

  test('header logo navigates to dashboard', async ({ page }) => {
    await page.goto('/settings');
    await page.click('.header__logo, a[href="/"]');
    await expect(page).toHaveURL(/\/$/);
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
    await expect(page.locator('.goals-page, .goals')).toBeVisible();
  });

  test('can navigate to Settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.settings-page')).toBeVisible();
  });

  test('mobile nav shows 5 items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // class is mobile-nav-item (no BEM double-underscore)
    await expect(page.locator('.mobile-nav-item')).toHaveCount(5);
  });

  test('mobile nav Settings link works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('.mobile-nav-item:has-text("Settings")').click();
    await expect(page.locator('.settings-page')).toBeVisible();
  });
});
