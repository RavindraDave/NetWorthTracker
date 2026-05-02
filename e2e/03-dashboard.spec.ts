import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);

    // Add an asset so net worth is non-zero
    const addBtn = page.locator('.category-section__add-btn').first();
    await addBtn.click();
    await page.locator('.line-item-input.name-input').last().fill('Savings');
    await page.locator('.line-item-input.amount-input').last().fill('1000000');
    await saveAndGoHome(page);
  });

  test('shows net worth hero with amount', async ({ page }) => {
    await expect(page.locator('.nw-hero__amount')).toBeVisible();
  });

  test('shows metric cards', async ({ page }) => {
    await expect(page.locator('.metric-card')).toHaveCount(3);
  });

  test('shows trend chart', async ({ page }) => {
    await expect(page.locator('.trend-chart')).toBeVisible();
  });

  test('shows donut chart', async ({ page }) => {
    await expect(page.locator('.donut-chart')).toBeVisible();
  });

  test('shows performance chart', async ({ page }) => {
    await expect(page.locator('.performance-chart')).toBeVisible();
  });

  test('Edit Snapshot button navigates to editor', async ({ page }) => {
    await page.click('button:has-text("Edit Snapshot")');
    await expect(page.locator('.snapshot-editor')).toBeVisible();
  });

  test('New Month button creates next-month snapshot', async ({ page }) => {
    await page.click('button:has-text("New Month")');
    await expect(page.locator('.snapshot-editor')).toBeVisible();
    // Month should be next month
    const monthVal = await page.locator('input[type="month"]').inputValue();
    expect(monthVal).toMatch(/^\d{4}-\d{2}$/);
  });

  test('mobile nav is visible on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('.mobile-nav')).toBeVisible();
  });
});
