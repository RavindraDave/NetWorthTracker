import { Snapshot, Goal, UserPreferences } from '../types';
import * as XLSX from 'xlsx';

export interface BackupData {
  version: number;
  exportDate: string;
  snapshots: Snapshot[];
  goals: Goal[];
  preferences: UserPreferences;
}

/**
 * Generates a JSON string representing the full state of the user's data.
 */
export function exportToJSON(
  snapshots: Snapshot[],
  goals: Goal[],
  preferences: UserPreferences
): string {
  const data: BackupData = {
    version: 1,
    exportDate: new Date().toISOString(),
    snapshots,
    goals,
    preferences
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Parses a JSON backup string into application data.
 * Validates both the top-level structure and the shape of individual records.
 */
export function parseBackupJSON(jsonString: string): BackupData {
  try {
    const data = JSON.parse(jsonString);

    // Top-level structure
    if (!data || typeof data !== 'object') throw new Error('Not a valid JSON object.');
    if (data.version !== 1) throw new Error(`Unsupported backup version: ${data.version}. Expected 1.`);
    if (!Array.isArray(data.snapshots)) throw new Error('Missing or invalid snapshots array.');
    if (!Array.isArray(data.goals)) throw new Error('Missing or invalid goals array.');
    if (!data.preferences || typeof data.preferences !== 'object') throw new Error('Missing preferences object.');

    // Validate each snapshot has required fields
    for (let i = 0; i < data.snapshots.length; i++) {
      const snap = data.snapshots[i];
      if (typeof snap.id !== 'string' || !snap.id)
        throw new Error(`Snapshot[${i}]: missing or invalid id.`);
      if (typeof snap.month !== 'string' || !/^\d{4}-\d{2}$/.test(snap.month))
        throw new Error(`Snapshot[${i}]: invalid month format "${snap.month}" — expected YYYY-MM.`);
      if (!Array.isArray(snap.categories))
        throw new Error(`Snapshot[${i}] (${snap.month}): missing categories array.`);
      if (typeof snap.exchangeRates !== 'object' || snap.exchangeRates === null)
        throw new Error(`Snapshot[${i}] (${snap.month}): missing exchangeRates object.`);
    }

    // Validate preferences required fields
    if (typeof data.preferences.baseCurrency !== 'string' || !data.preferences.baseCurrency)
      throw new Error('preferences.baseCurrency is missing or invalid.');
    if (!Array.isArray(data.preferences.enabledCurrencies))
      throw new Error('preferences.enabledCurrencies is missing or invalid.');

    return data as BackupData;
  } catch (err: any) {
    throw new Error(`Failed to parse backup: ${err.message}`);
  }
}

/**
 * Triggers a download of a file in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Quick CSV export for a snapshot's line items.
 */
export function exportSnapshotToCSV(snapshot: Snapshot) {
  let csv = 'Category,Type,Item Name,Currency,Amount,Excluded\n';
  snapshot.categories.forEach(cat => {
    cat.items.forEach(item => {
      // Escape names for CSV
      const safeCatName = cat.name.replace(/"/g, '""');
      const safeItemName = item.name.replace(/"/g, '""');
      csv += `"${safeCatName}","${cat.type}","${safeItemName}",${item.currency},${item.amount},${item.excludeFromNetWorth ? 'Yes' : 'No'}\n`;
    });
  });
  return csv;
}

export type ExcelRow = Record<string, string | number | boolean | undefined>;

/**
 * Very basic Excel parser for a predefined format to import a snapshot.
 * Extracted rows are loosely mapped.
 */
export async function parseExcelToSnapshotItems(file: File): Promise<ExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to JSON array
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json as ExcelRow[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
