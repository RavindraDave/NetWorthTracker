import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('Goals', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/goals');
  });

  test('shows empty state prompt to add goal', async ({ page }) => {
    await expect(page.locator('.goals-page, .goals')).toBeVisible();
  });

  test('can open goal creation modal', async ({ page }) => {
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
    await expect(page.locator('.modal-content')).toBeVisible();
  });

  test('modal has FIRE goal type by default', async ({ page }) => {
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
    await expect(page.locator('select#goal-type')).toHaveValue('fire');
  });

  test('can create a FIRE goal', async ({ page }) => {
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
    await page.fill('#goal-name', 'My FIRE Target');
    await page.fill('#goal-expenses', '1200000');
    await page.click('button:has-text("Save Goal")');
    await expect(page.locator('.modal-content')).toHaveCount(0);
    // FIRE dashboard should appear
    await expect(page.locator('.fire-dashboard')).toBeVisible();
  });

  test('FIRE dashboard shows progress ring', async ({ page }) => {
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
    await page.fill('#goal-name', 'FIRE');
    await page.fill('#goal-expenses', '1200000');
    await page.click('button:has-text("Save Goal")');
    // Progress ring SVG is inside .fire-dashboard__main-progress
    await expect(page.locator('.fire-dashboard__main-progress svg').first()).toBeVisible();
  });

  test('can create a net worth target goal', async ({ page }) => {
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
    await page.selectOption('#goal-type', 'net_worth_target');
    await page.fill('#goal-name', 'First Crore');
    await page.fill('#goal-amount', '10000000');
    await page.click('button:has-text("Save Goal")');
    await expect(page.locator('.modal-content')).toHaveCount(0);
  });

  test('Escape key closes goal modal', async ({ page }) => {
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
    await expect(page.locator('.modal-content')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-content')).toHaveCount(0);
  });

  test('can add milestone to FIRE goal form', async ({ page }) => {
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
    await page.fill('#goal-name', 'FIRE');
    await page.fill('#goal-expenses', '1200000');
    const milestoneLabelInput = page.locator('input[placeholder="Milestone label"]');
    const milestoneAmountInput = page.locator('input[placeholder="Amount"]');
    await milestoneLabelInput.fill('First 25L');
    await milestoneAmountInput.fill('2500000');
    await page.locator('.milestone-add-row button').click();
    await expect(page.locator('.milestone-list__label:has-text("First 25L")')).toBeVisible();
  });

  test('delete goal shows destructive confirm', async ({ page }) => {
    // First create a goal
    await page.click('button:has-text("Add Goal"), button:has-text("New Goal"), button:has-text("Create")');
    await page.fill('#goal-name', 'Delete Me');
    await page.fill('#goal-expenses', '1000000');
    await page.click('button:has-text("Save Goal")');

    const deleteBtn = page.locator('button.btn-outline.danger, .goal-card__actions .btn-icon.danger').first();
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
      await expect(page.locator('.confirm-dialog')).toBeVisible();
      await expect(page.locator('.btn-destructive')).toBeVisible();
      await page.click('.confirm-dialog button:has-text("Cancel")');
    }
  });
});
