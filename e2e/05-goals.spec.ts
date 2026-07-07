import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

async function openGoalModal(page: import('@playwright/test').Page) {
  await page.click('button:has-text("Create First Goal"), button:has-text("Add Goal")');
  await expect(page.locator('.modal-content')).toBeVisible();
}

test.describe('Goals', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await page.goto('/goals');
    await page.waitForSelector('.goals-page');
  });

  test('shows empty state prompt to add a goal', async ({ page }) => {
    await expect(page.locator('button:has-text("Create First Goal")')).toBeVisible();
  });

  test('goal modal defaults to the FIRE type', async ({ page }) => {
    await openGoalModal(page);
    await expect(page.locator('select#goal-type')).toHaveValue('fire');
  });

  test('can create a FIRE goal', async ({ page }) => {
    await openGoalModal(page);
    await page.fill('#goal-name', 'My FIRE Target');
    await page.fill('#goal-expenses', '1200000');
    await page.click('button:has-text("Save Goal")');
    await expect(page.locator('.modal-content')).toHaveCount(0);
    await expect(page.locator('.fire-dashboard')).toBeVisible();
    await expect(page.locator('.fire-dash-progress-bar')).toBeVisible();
  });

  test('can create a net worth target goal', async ({ page }) => {
    await openGoalModal(page);
    await page.selectOption('#goal-type', 'net_worth_target');
    await page.fill('#goal-name', 'First Crore');
    await page.fill('#goal-amount', '10000000');
    await page.click('button:has-text("Save Goal")');
    await expect(page.locator('.modal-content')).toHaveCount(0);
  });

  test('Escape key closes the goal modal', async ({ page }) => {
    await openGoalModal(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-content')).toHaveCount(0);
  });

  test('can add a milestone in the goal form', async ({ page }) => {
    await openGoalModal(page);
    await page.fill('#goal-name', 'FIRE');
    await page.fill('#goal-expenses', '1200000');
    await page.locator('.milestone-add-row input[placeholder="Label"]').fill('First 25L');
    await page.locator('.milestone-add-row input').nth(1).fill('2500000');
    await page.keyboard.press('Tab'); // commit the decimal input
    await page.locator('.milestone-add-row button').click();
    await expect(page.locator('.milestone-list__label:has-text("First 25L")')).toBeVisible();
  });

  test('what-if scenario panel opens on the FIRE dashboard', async ({ page }) => {
    await openGoalModal(page);
    await page.fill('#goal-name', 'FIRE');
    await page.fill('#goal-expenses', '1200000');
    await page.click('button:has-text("Save Goal")');
    await page.click('button:has-text("What if?")');
    await expect(page.locator('.fire-scenario-panel')).toBeVisible();
  });

  test('deleting a goal shows a destructive confirm', async ({ page }) => {
    await openGoalModal(page);
    await page.fill('#goal-name', 'Delete Me');
    await page.fill('#goal-expenses', '1000000');
    await page.click('button:has-text("Save Goal")');
    await page.locator('.fire-dashboard button:has-text("Delete")').click();
    await expect(page.locator('.confirm-dialog')).toBeVisible();
    await expect(page.locator('.btn-destructive')).toBeVisible();
    await page.click('.confirm-dialog button:has-text("Cancel")');
  });
});
