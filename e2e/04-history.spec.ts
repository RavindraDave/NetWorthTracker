import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, addLineItem, saveAndGoHome, setSnapshotMonth, monthOffset } from './helpers';

test.describe('History', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    // Snapshot 1 — two months ago
    await createFirstSnapshot(page);
    await setSnapshotMonth(page, monthOffset(2));
    await addLineItem(page, 'Savings', '500000');
    await saveAndGoHome(page);
    // Snapshot 2 — current month, via the missing-snapshot banner
    await page.getByRole('button', { name: 'Create snapshot' }).click();
    await page.waitForSelector('.editor-page');
    await addLineItem(page, 'Savings 2', '100000');
    await saveAndGoHome(page);

    await page.goto('/history');
    await page.waitForSelector('.history-page');
  });

  test('shows one card per snapshot', async ({ page }) => {
    await expect(page.locator('.hist-card')).toHaveCount(2);
  });

  test('date-range filter reduces visible cards and shows a count badge', async ({ page }) => {
    const from = page.locator('.hist-filter-input').first();
    const to   = page.locator('.hist-filter-input').last();
    await from.fill(monthOffset(2));
    await to.fill(monthOffset(2));
    await expect(page.locator('.hist-card')).toHaveCount(1);
    await expect(page.locator('.hist-count-badge')).toHaveText('1 / 2');
  });

  test('clear button restores all cards', async ({ page }) => {
    await page.locator('.hist-filter-input').first().fill(monthOffset(2));
    await page.click('button:has-text("Clear")');
    await expect(page.locator('.hist-card')).toHaveCount(2);
  });

  test('search matches notes and months', async ({ page }) => {
    await page.locator('input[aria-label="Search snapshots"]').fill(monthOffset(2));
    await expect(page.locator('.hist-card')).toHaveCount(1);
  });

  test('expanding a card shows the category breakdown', async ({ page }) => {
    await page.locator('.hist-card-row').first().click();
    await expect(page.locator('.hist-breakdown')).toBeVisible();
  });

  test('edit button navigates to the editor', async ({ page }) => {
    await page.locator('button[aria-label^="Edit"]').first().click();
    await expect(page.locator('.editor-page')).toBeVisible();
  });

  test('delete shows a destructive confirm dialog', async ({ page }) => {
    await page.locator('button[aria-label^="Delete"]').first().click();
    await expect(page.locator('.confirm-dialog')).toBeVisible();
    await expect(page.locator('.btn-destructive')).toBeVisible();
    await page.click('.confirm-dialog button:has-text("Cancel")');
    await expect(page.locator('.hist-card')).toHaveCount(2);
  });

  test('comparing two snapshots opens the compare modal', async ({ page }) => {
    const selects = page.locator('.hist-select');
    await selects.first().selectOption({ index: 1 });
    await selects.last().selectOption({ index: 2 });
    const compareBtn = page.locator('button:has-text("Compare")');
    await expect(compareBtn).toBeEnabled();
    await compareBtn.click();
    await expect(page.locator('.compare-modal')).toBeVisible();
    await page.locator('.compare-modal button[aria-label="Close"]').click();
    await expect(page.locator('.compare-modal')).toHaveCount(0);
  });
});
