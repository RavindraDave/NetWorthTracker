import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

async function openSection(page: import('@playwright/test').Page, label: string) {
  await page.locator(`.settings-nav-btn:has-text("${label}")`).click();
}

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/settings');
    await page.waitForSelector('.settings-page');
  });

  test('loads with the Preferences section by default', async ({ page }) => {
    await expect(page.locator('h2:has-text("Preferences")')).toBeVisible();
  });

  test('can change base currency', async ({ page }) => {
    const select = page.locator('#base-currency');
    await select.selectOption('USD');
    await expect(select).toHaveValue('USD');
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    await page.locator('.theme-toggle-btn:has-text("Light")').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('.theme-toggle-btn:has-text("Dark")').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('currency list is searchable and a currency can be enabled', async ({ page }) => {
    await openSection(page, 'Currencies');
    await page.locator('input[placeholder="Search currencies…"]').fill('JPY');
    const jpyChip = page.locator('.currency-chip:has-text("JPY")');
    await expect(jpyChip).toBeVisible();
    const isActive = await jpyChip.evaluate(el => el.classList.contains('active'));
    if (!isActive) await jpyChip.click();
    await expect(jpyChip).toHaveClass(/active/);
  });

  test('Data & Backup section shows export and unified import cards', async ({ page }) => {
    await openSection(page, 'Data & Backup');
    await expect(page.locator('h2:has-text("Data & Backup")')).toBeVisible();
    await expect(page.locator('button:has-text("Download JSON")')).toBeVisible();
    await expect(page.locator('h3:has-text("Import from CSV / Excel")')).toBeVisible();
  });

  test('export backup triggers a download', async ({ page }) => {
    await openSection(page, 'Data & Backup');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.click('button:has-text("Download JSON")'),
    ]);
    expect(download.suggestedFilename()).toMatch(/wealthpulse-backup.*\.json/);
  });

  test('auto-backup enable/disable toggle works', async ({ page }) => {
    await openSection(page, 'Data & Backup');
    await expect(page.locator('h2:has-text("Auto-Backup")')).toBeVisible();
    const toggleBtn = page
      .locator('.data-action-card', { hasText: 'Scheduled File Export' })
      .locator('button')
      .first();
    const initialText = (await toggleBtn.textContent())?.trim();
    await toggleBtn.click();
    const expectedText = initialText === 'Enabled' ? 'Disabled' : 'Enabled';
    await expect(toggleBtn).toHaveText(expectedText, { timeout: 5000 });
  });

  test('Save Now creates a backup in recovery history', async ({ page }) => {
    await openSection(page, 'Data & Backup');
    await page.click('button:has-text("Save Now")');
    await page.locator('button:has-text("Show History")').click();
    await expect(page.locator('.auto-backup-row').first()).toBeVisible({ timeout: 8000 });
  });

  test('category manager is visible', async ({ page }) => {
    await openSection(page, 'Categories');
    await expect(page.locator('.cat-manager')).toBeVisible();
  });

  test('can add a custom category', async ({ page }) => {
    await openSection(page, 'Categories');
    await page.fill('input[placeholder="Category name"]', 'Crypto Assets');
    await page.locator('.cat-manager button:has-text("Add")').click();
    await expect(page.locator('.cat-manager__name:has-text("Crypto Assets")')).toBeVisible();
  });

  test('can rename a custom category', async ({ page }) => {
    await openSection(page, 'Categories');
    await page.fill('input[placeholder="Category name"]', 'Old Name');
    await page.locator('.cat-manager button:has-text("Add")').click();
    const row = page.locator('.cat-manager__item', { hasText: 'Old Name' });
    await row.locator('button[aria-label="Rename category"]').click();
    const renameInput = page.locator('.cat-manager__rename-input');
    await renameInput.fill('New Name');
    await renameInput.press('Enter');
    await expect(page.locator('.cat-manager__name:has-text("New Name")')).toBeVisible();
  });

  test('can delete an unused custom category', async ({ page }) => {
    await openSection(page, 'Categories');
    await page.fill('input[placeholder="Category name"]', 'To Delete');
    await page.locator('.cat-manager button:has-text("Add")').click();
    await expect(page.locator('.cat-manager__name:has-text("To Delete")')).toBeVisible();
    const row = page.locator('.cat-manager__item', { hasText: 'To Delete' });
    await row.locator('button[aria-label="Remove category"]').click();
    // Accept an optional confirm dialog
    const dialog = page.locator('.confirm-dialog');
    if (await dialog.count() > 0) {
      await dialog.locator('.btn-destructive, .btn-primary').click();
    }
    await expect(page.locator('.cat-manager__name:has-text("To Delete")')).toHaveCount(0);
  });
});
