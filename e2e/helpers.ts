import { Page } from '@playwright/test';

/**
 * Clears ALL app data (IndexedDB + localStorage) so each test starts fresh.
 * localStorage matters too: it holds banner snoozes, the chips first-run
 * intro flag, and the last-viewed Settings section — all of which change
 * what the next test sees.
 */
export async function clearAppData(page: Page) {
  await page.goto('/');
  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      localStorage.clear();
      const req = indexedDB.deleteDatabase('WealthPulseDB');
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
      req.onblocked = () => resolve(); // treat blocked as ok for tests
    })
  );
  await page.reload();
}

/** Wait for any page shell to render */
export async function waitForApp(page: Page) {
  await page.waitForSelector('.wp-page', { timeout: 10000 });
}

/** Create a first snapshot via the empty-state CTA */
export async function createFirstSnapshot(page: Page) {
  await page.click('button:has-text("Create First Snapshot")');
  await page.waitForSelector('.editor-page', { timeout: 8000 });
}

/**
 * Add a line item through the first category's AddItemRow.
 * The add-row inputs have unique aria-labels ("New item …"), distinct from
 * saved rows ("Item name" / "Amount in …").
 */
export async function addLineItem(page: Page, name: string, amount: string) {
  await page.locator('input[aria-label="New item name"]').first().fill(name);
  await page.locator('input[aria-label^="New item amount"]').first().fill(amount);
  await page.locator('button[aria-label="Add item"]').first().click();
  // The committed row appears as a regular line item
  await page.locator(`input[aria-label="Item name"][value="${name}"]`).waitFor({ timeout: 5000 });
}

/** Set the snapshot month in the editor ("YYYY-MM") */
export async function setSnapshotMonth(page: Page, month: string) {
  await page.fill('input[aria-label="Snapshot month"]', month);
}

/**
 * Open the editor via the sidebar "Snapshot Editor" action. It opens a
 * month-picker modal first; the submit button reads "Open Snapshot" when the
 * month already exists, "Create Snapshot" otherwise.
 */
export async function openSnapshotEditor(page: Page) {
  await page.locator('button:has-text("Snapshot Editor")').click();
  await page.waitForSelector('.modal-content');
  await page.locator('button:has-text("Open Snapshot"), .modal-content button:has-text("Create Snapshot")').first().click();
  await page.waitForSelector('.editor-page', { timeout: 8000 });
}

/** Save snapshot and land on the dashboard */
export async function saveAndGoHome(page: Page) {
  await page.click('button:has-text("Save Snapshot")');
  await page.waitForSelector('.hero-card', { timeout: 10000 });
}

/** "YYYY-MM" for the month `offset` months before now (0 = current). */
export function monthOffset(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
