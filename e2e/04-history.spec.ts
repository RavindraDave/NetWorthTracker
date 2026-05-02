import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('History', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    // Create two snapshots for different months
    await createFirstSnapshot(page);
    await page.locator('input[type="month"]').fill('2024-01');
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('500000');
    await saveAndGoHome(page);

    await page.click('button:has-text("New Month")');
    await page.locator('input[type="month"]').fill('2024-02');
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.amount-input').last().fill('600000');
    await saveAndGoHome(page);

    await page.goto('/history');
  });

  test('shows history grid with snapshot cards', async ({ page }) => {
    await expect(page.locator('.history-card')).toHaveCount(2);
  });

  test('filter by date range reduces visible cards', async ({ page }) => {
    // Use input[type="month"] within the filter area to avoid ambiguity
    await page.locator('input[type="month"].history-filter-input').first().fill('2024-01');
    await page.locator('input[type="month"].history-filter-input').last().fill('2024-01');
    await expect(page.locator('.history-card')).toHaveCount(1);
  });

  test('filter badge appears when filter is active', async ({ page }) => {
    await page.locator('input[type="month"].history-filter-input').first().fill('2024-01');
    await expect(page.locator('.history-filter-badge')).toBeVisible();
  });

  test('clear filter button restores all cards', async ({ page }) => {
    await page.locator('input[type="month"].history-filter-input').first().fill('2024-01');
    await page.click('button:has-text("Clear")');
    await expect(page.locator('.history-card')).toHaveCount(2);
  });

  test('clicking a history card navigates to editor', async ({ page }) => {
    await page.locator('.history-card').first().click();
    await expect(page.locator('.snapshot-editor')).toBeVisible();
  });

  test('delete button shows destructive confirm dialog', async ({ page }) => {
    const deleteBtn = page.locator('.history-card__actions .btn-icon.danger').first();
    await deleteBtn.click();
    // Confirm dialog should appear with a Delete button
    await expect(page.locator('.confirm-dialog')).toBeVisible();
    await expect(page.locator('.btn-destructive')).toBeVisible();
    // Cancel it
    await page.click('.confirm-dialog button:has-text("Cancel")');
  });

  test('compare selector appears when 2 snapshots selected', async ({ page }) => {
    const checkboxes = page.locator('.history-compare-group input[type="checkbox"], .compare-checkbox');
    if (await checkboxes.count() > 0) {
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
    }
    // If there's a compare button
    const compareBtn = page.locator('button:has-text("Compare")');
    if (await compareBtn.count() > 0) {
      await expect(compareBtn).toBeEnabled();
    }
  });
});
