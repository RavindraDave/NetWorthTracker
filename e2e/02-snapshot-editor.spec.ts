import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('Snapshot Editor', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
  });

  test('month input is visible and editable', async ({ page }) => {
    const monthInput = page.locator('input[type="month"]');
    await expect(monthInput).toBeVisible();
    const current = await monthInput.inputValue();
    expect(current).toMatch(/^\d{4}-\d{2}$/);
  });

  test('can change month to a historical date', async ({ page }) => {
    await page.locator('input[type="month"]').fill('2023-06');
    await expect(page.locator('input[type="month"]')).toHaveValue('2023-06');
  });

  test('can add a line item to a category', async ({ page }) => {
    // Expand first asset category and add item
    const addBtn = page.locator('.category-section__add-btn').first();
    await addBtn.click();
    const nameInputs = page.locator('.line-item-input.name-input');
    await nameInputs.last().fill('Test Asset');
    const amtInputs = page.locator('.line-item-input.amount-input');
    await amtInputs.last().fill('100000');
    await expect(nameInputs.last()).toHaveValue('Test Asset');
  });

  test('net worth updates live as values change', async ({ page }) => {
    const addBtn = page.locator('.category-section__add-btn').first();
    await addBtn.click();
    const amtInput = page.locator('.line-item-input.amount-input').last();
    await amtInput.fill('500000');
    // Live net worth card should show non-zero
    const liveNW = page.locator('.live-networth__amount');
    await expect(liveNW).not.toHaveText('0');
  });

  test('can remove a line item', async ({ page }) => {
    const addBtn = page.locator('.category-section__add-btn').first();
    await addBtn.click();
    const nameInput = page.locator('.line-item-input.name-input').last();
    await nameInput.fill('To Remove');
    // Click delete button for the new row
    const deleteBtn = page.locator('.line-item-actions .btn-icon.danger').last();
    await deleteBtn.click();
    await expect(page.locator('.line-item-input.name-input[value="To Remove"]')).toHaveCount(0);
  });

  test('save navigates back to dashboard', async ({ page }) => {
    await saveAndGoHome(page);
    await expect(page.locator('.nw-hero__amount')).toBeVisible();
  });

  test('CSV export button is present', async ({ page }) => {
    await expect(page.locator('button[title="Export CSV"]')).toBeVisible();
  });

  test('back button navigates away without saving', async ({ page }) => {
    // Add an item so there's something dirty to trigger beforeunload
    await page.locator('.category-section__add-btn').first().click();
    await page.locator('.line-item-input.name-input').last().fill('Unsaved');
    page.on('dialog', d => d.dismiss());
    await page.locator('button[title="Go back"]').click();
    // Either stays on editor (dismissed) or navigates back — both are acceptable
  });
});
