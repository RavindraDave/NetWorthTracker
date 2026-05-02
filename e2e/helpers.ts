import { Page } from '@playwright/test';

/**
 * Clears ALL IndexedDB data for WealthPulseDB so each test starts fresh.
 * Must be called before navigating (or on about:blank).
 */
export async function clearAppData(page: Page) {
  await page.goto('http://localhost:3000');
  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('WealthPulseDB');
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
      req.onblocked = () => resolve(); // treat blocked as ok for tests
    })
  );
  await page.reload();
}

/** Wait for the app to finish loading (spinner gone, content visible) */
export async function waitForApp(page: Page) {
  await page.waitForSelector('.dashboard, .settings-page, .history-page, .goals-page, .portfolio-page, .snapshot-editor', { timeout: 10000 });
}

/** Create a first snapshot via the empty-state CTA */
export async function createFirstSnapshot(page: Page) {
  await page.click('button:has-text("Create First Snapshot")');
  await page.waitForSelector('.snapshot-editor', { timeout: 8000 });
}

/** Save snapshot and return to dashboard */
export async function saveAndGoHome(page: Page) {
  await page.click('button:has-text("Save Snapshot")');
  await page.waitForURL('**/');
  await waitForApp(page);
}
