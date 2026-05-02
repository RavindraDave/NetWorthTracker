import { test, expect } from '@playwright/test';
import { clearAppData, createFirstSnapshot, saveAndGoHome } from './helpers';

test.describe('Onboarding — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
  });

  test('shows welcome screen with CTA on first load', async ({ page }) => {
    await expect(page.locator('h2:has-text("Welcome to WealthPulse")')).toBeVisible();
    await expect(page.locator('button:has-text("Create First Snapshot")')).toBeVisible();
  });

  test('CTA navigates to snapshot editor', async ({ page }) => {
    await createFirstSnapshot(page);
    await expect(page.locator('.snapshot-editor')).toBeVisible();
    await expect(page.locator('input[type="month"]')).toBeVisible();
  });

  test('saving first snapshot shows dashboard with net worth hero', async ({ page }) => {
    await createFirstSnapshot(page);
    await saveAndGoHome(page);
    await expect(page.locator('.nw-hero__amount')).toBeVisible();
  });
});
