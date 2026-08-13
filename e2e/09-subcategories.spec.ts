import { test, expect, Page } from '@playwright/test';
import {
  clearAppData, createFirstSnapshot, addLineItem, saveAndGoHome,
  openSnapshotEditor, setSnapshotMonth,
} from './helpers';

/**
 * Locators are scoped by container and matched on text, never by index.
 * Grouping multiplies the rows inside a category, so an `.nth()` locator taken
 * before a mutation will point somewhere else after it — which is exactly what
 * produced a false "data loss" report in a previous review.
 */
const investments = (page: Page) =>
  page.locator('.category-section', { hasText: 'Investments' });

/**
 * Match a group by its HEADER, not by `hasText` over the whole group: every row
 * inside a group carries a <select> listing all sibling group names, so a plain
 * text filter for "Stocks" also matches the Mutual Funds group.
 */
const group = (page: Page, name: string) =>
  investments(page).locator('.subcat-group').filter({
    has: page.locator('.subcat-header__name', { hasText: new RegExp(`^${name}$`) }),
  });

/** Add the suggested groups to Investments (Mutual Funds, Stocks, ETFs, Bonds). */
async function seedGroups(page: Page) {
  await investments(page)
    .locator('button[aria-label="Add suggested sub-groups to Investments"]')
    .click();
  await expect(group(page, 'Mutual Funds')).toBeVisible();
}

test.describe('Sub-categories', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
    await createFirstSnapshot(page);
  });

  test('a fresh snapshot shows no group chrome', async ({ page }) => {
    await expect(page.locator('.subcat-group')).toHaveCount(0);
    await expect(page.locator('.subcat-header')).toHaveCount(0);
    // The plain add row is still the one users see first.
    await expect(page.locator('input[aria-label="New item name"]').first()).toBeVisible();
  });

  test('suggested groups appear on demand and are scoped to one category', async ({ page }) => {
    await seedGroups(page);

    const names = investments(page).locator('.subcat-header__name');
    await expect(names).toHaveText(['Mutual Funds', 'Stocks', 'ETFs', 'Bonds', 'Ungrouped']);

    // A different category is untouched.
    await expect(
      page.locator('.category-section', { hasText: 'Real Estate' }).locator('.subcat-group'),
    ).toHaveCount(0);
  });

  test('an item added inside a group stays in that group and lifts its subtotal', async ({ page }) => {
    await seedGroups(page);
    await addLineItem(page, 'Parag Parikh Flexi Cap', '250000', { group: 'Mutual Funds' });

    const mf = group(page, 'Mutual Funds');
    await expect(mf.locator('input[aria-label="Item name"]')).toHaveValue('Parag Parikh Flexi Cap');
    await expect(mf.locator('.subcat-header__total')).toContainText('2,50,000');

    // A sibling group did not absorb it.
    await expect(group(page, 'Stocks').locator('input[aria-label="Item name"]')).toHaveCount(0);
  });

  test('creating a group that already exists does not duplicate it', async ({ page }) => {
    await seedGroups(page);

    await investments(page).locator('button[aria-label="Add a sub-group to Investments"]').click();
    const input = investments(page).locator('input[aria-label="New sub-group in Investments"]');
    await input.fill('  mutual   FUNDS ');
    await input.press('Enter');

    await expect(
      investments(page).locator('.subcat-header__name', { hasText: /^Mutual Funds$/ }),
    ).toHaveCount(1);
  });

  test('deleting a group keeps its items, moving them to Ungrouped', async ({ page }) => {
    await seedGroups(page);
    await addLineItem(page, 'Nifty Index Fund', '100000', { group: 'Mutual Funds' });
    await expect(investments(page).locator('input[aria-label="Item name"]')).toHaveCount(1);

    await investments(page).locator('button[aria-label="Options for group Mutual Funds"]').click();
    await investments(page).getByRole('menuitem', { name: /Delete group/ }).click();
    await page.locator('.confirm-dialog button:has-text("Delete")').click();

    await expect(group(page, 'Mutual Funds')).toHaveCount(0);
    // The item survives, now under Ungrouped.
    await expect(investments(page).locator('input[aria-label="Item name"]')).toHaveCount(1);
    await expect(
      group(page, 'Ungrouped').locator('input[aria-label="Item name"]'),
    ).toHaveValue('Nifty Index Fund');
  });

  test('grouping survives a save and reopen', async ({ page }) => {
    await seedGroups(page);
    await addLineItem(page, 'Parag Parikh Flexi Cap', '250000', { group: 'Mutual Funds' });
    await saveAndGoHome(page);

    await openSnapshotEditor(page);

    await expect(group(page, 'Mutual Funds').locator('input[aria-label="Item name"]'))
      .toHaveValue('Parag Parikh Flexi Cap');
  });

  test('grouping carries forward into the next month', async ({ page }) => {
    await seedGroups(page);
    await addLineItem(page, 'Parag Parikh Flexi Cap', '250000', { group: 'Mutual Funds' });
    await setSnapshotMonth(page, '2026-03');
    await saveAndGoHome(page);

    // Clone into the following month via the editor's month picker.
    await openSnapshotEditor(page);
    await setSnapshotMonth(page, '2026-04');

    await expect(group(page, 'Mutual Funds').locator('input[aria-label="Item name"]'))
      .toHaveValue('Parag Parikh Flexi Cap');
  });

  test('the category total still equals the sum of its group subtotals', async ({ page }) => {
    await seedGroups(page);
    await addLineItem(page, 'Fund A', '100000', { group: 'Mutual Funds' });
    await addLineItem(page, 'Reliance', '50000', { group: 'Stocks' });
    await addLineItem(page, 'Loose holding', '25000', { within: investments(page) });

    await expect(investments(page).locator('.category-section__total')).toContainText('1,75,000');
    await expect(group(page, 'Mutual Funds').locator('.subcat-header__total')).toContainText('1,00,000');
    await expect(group(page, 'Stocks').locator('.subcat-header__total')).toContainText('50,000');
    await expect(group(page, 'Ungrouped').locator('.subcat-header__total')).toContainText('25,000');
  });
});
