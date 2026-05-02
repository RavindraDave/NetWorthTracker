import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('Portfolio', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    // Add assets
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.name-input').last().fill('Index Fund');
    await page.locator('.line-item-input.amount-input').last().fill('500000');
    await saveAndGoHome(page);
    await page.goto('/portfolio');
  });

  test('portfolio page loads', async ({ page }) => {
    await expect(page.locator('.portfolio-page')).toBeVisible();
  });

  test('shows portfolio table with data', async ({ page }) => {
    await expect(page.locator('.portfolio-table, table, .portfolio-list')).toBeVisible();
  });

  test('view mode toggle is present on dashboard', async ({ page }) => {
    // View toggle (Overall/Assets/Liabilities) lives in NetWorthHero on dashboard, not portfolio
    await page.goto('/');
    await expect(page.locator('.view-toggle-btn').first()).toBeVisible();
  });
});
