import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/settings');
  });

  test('settings page loads with preferences section', async ({ page }) => {
    await expect(page.locator('.settings-page')).toBeVisible();
    await expect(page.locator('h2:has-text("Preferences")')).toBeVisible();
  });

  test('can change base currency', async ({ page }) => {
    const select = page.locator('#base-currency');
    await select.selectOption('USD');
    await expect(select).toHaveValue('USD');
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    await page.click('button:has-text("Light")');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.click('button:has-text("Dark")');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('currency chips are searchable', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('JPY');
    await expect(page.locator('.currency-chip:has-text("JPY")')).toBeVisible();
  });

  test('can enable a currency', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('JPY');
    const jpyChip = page.locator('.currency-chip:has-text("JPY")');
    if (await jpyChip.count() > 0) {
      const isActive = await jpyChip.evaluate(el => el.classList.contains('active'));
      if (!isActive) await jpyChip.click();
      await expect(jpyChip).toHaveClass(/active/);
    }
  });

  test('data management section is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Data Management")')).toBeVisible();
    await expect(page.locator('button:has-text("Download JSON")')).toBeVisible();
  });

  test('export backup triggers download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.click('button:has-text("Download JSON")'),
    ]);
    expect(download.suggestedFilename()).toMatch(/wealthpulse-backup.*\.json/);
  });

  test('auto-backup section is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Auto-Backup")')).toBeVisible();
  });

  test('auto-backup enable/disable toggle works', async ({ page }) => {
    const toggleBtn = page.locator('.settings-section:has(h2:has-text("Auto-Backup")) .btn').first();
    const initialText = (await toggleBtn.textContent())?.trim();
    await toggleBtn.click();
    // Wait for text to change after async preferences update
    const expectedText = initialText === 'Enabled' ? 'Disabled' : 'Enabled';
    await expect(toggleBtn).toHaveText(expectedText, { timeout: 5000 });
  });

  test('Save Now creates a backup in history', async ({ page }) => {
    await page.click('button:has-text("Save Now")');
    // Toggle history (button text includes current count with ellipsis)
    await page.locator('button:has-text("Show History")').click();
    // Wait for at least one row to appear (async DB load)
    await expect(page.locator('.auto-backup-row').first()).toBeVisible({ timeout: 8000 });
  });

  test('custom category manager is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Custom Categories")')).toBeVisible();
  });

  test('can add a custom category', async ({ page }) => {
    await page.fill('input[placeholder="Category name"]', 'Crypto Assets');
    await page.click('.cat-manager__form button:has-text("Add")');
    await expect(page.locator('.cat-manager__name:has-text("Crypto Assets")')).toBeVisible();
  });

  test('can rename a custom category', async ({ page }) => {
    // Add one first
    await page.fill('input[placeholder="Category name"]', 'Old Name');
    await page.click('.cat-manager__form button:has-text("Add")');
    // Click rename
    await page.locator('.cat-manager__item button[aria-label="Rename category"]').first().click();
    const renameInput = page.locator('.cat-manager__rename-input');
    await renameInput.clear();
    await renameInput.fill('New Name');
    await renameInput.press('Enter');
    await expect(page.locator('.cat-manager__name:has-text("New Name")')).toBeVisible();
  });

  test('can delete a custom category', async ({ page }) => {
    await page.fill('input[placeholder="Category name"]', 'To Delete');
    await page.click('.cat-manager__form button:has-text("Add")');
    await expect(page.locator('.cat-manager__name:has-text("To Delete")')).toBeVisible();
    await page.locator('.cat-manager__item button[aria-label="Remove category"]').first().click();
    await expect(page.locator('.cat-manager__name:has-text("To Delete")')).toHaveCount(0);
  });
});
