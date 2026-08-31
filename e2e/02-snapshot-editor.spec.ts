import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, addLineItem, saveAndGoHome } from './helpers';

test.describe('Snapshot Editor', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
  });

  test('month input is visible and editable', async ({ page }) => {
    const monthInput = page.locator('input[aria-label="Snapshot month"]');
    await expect(monthInput).toBeVisible();
    const current = await monthInput.inputValue();
    expect(current).toMatch(/^\d{4}-\d{2}$/);
  });

  test('can change month to a historical date', async ({ page }) => {
    await page.locator('input[aria-label="Snapshot month"]').fill('2023-06');
    await expect(page.locator('input[aria-label="Snapshot month"]')).toHaveValue('2023-06');
  });

  test('can add a line item to a category', async ({ page }) => {
    await addLineItem(page, 'Test Asset', '100000');
    await expect(page.locator('input[aria-label="Item name"]').last()).toHaveValue('Test Asset');
  });

  test('net worth updates live as values change', async ({ page }) => {
    await addLineItem(page, 'Cash', '500000');
    // Live net worth preview should show the amount (INR lakh grouping)
    await expect(page.locator('.live-preview-val')).toContainText('5,00,000');
  });

  test('can remove a line item', async ({ page }) => {
    await addLineItem(page, 'To Remove', '1000');
    await page.locator('button[aria-label="Remove item"]').last().click();
    // Removing an item now asks for confirmation.
    await page.locator('.confirm-dialog button:has-text("Delete")').click();
    await expect(page.locator('input[aria-label="Item name"]')).toHaveCount(0);
  });

  test('save navigates back to dashboard', async ({ page }) => {
    await saveAndGoHome(page);
    await expect(page.locator('.hero-num')).toBeVisible();
  });

  test('export menu offers CSV, Excel and Print', async ({ page }) => {
    await page.click('button:has-text("Export")');
    const menu = page.locator('.export-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.export-menu-item:has-text("CSV")')).toBeVisible();
    await expect(menu.locator('.export-menu-item:has-text("Excel")')).toBeVisible();
    await expect(menu.locator('.export-menu-item:has-text("Print")')).toBeVisible();
  });

  test('navigating away with unsaved changes asks for confirmation', async ({ page }) => {
    await addLineItem(page, 'Unsaved Item', '123');
    // Leave via the sidebar — the router blocker should raise the confirm dialog
    await page.locator('a[href="/history"]').first().click();
    const dialog = page.locator('.confirm-dialog');
    await expect(dialog).toBeVisible();
    // Cancel keeps us on the editor
    await dialog.locator('button:has-text("Cancel")').click();
    await expect(page.locator('.editor-page')).toBeVisible();
  });
});
