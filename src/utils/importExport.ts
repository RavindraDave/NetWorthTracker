import { Snapshot, Goal, UserPreferences } from '../types';
import * as XLSX from 'xlsx';
import { calcNetWorth, convertToBase } from './calculations';
import { buildAccountReturns, annualisedReturn, monthEndDate } from './returns';

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse backup: ${msg}`);
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
 * Make a string safe to embed in a CSV cell.
 * 1. Neutralises spreadsheet formula injection: a value beginning with =, +, -, @,
 *    or a control char is executed as a formula when the file is opened in Excel /
 *    Google Sheets. Prefix such values with a single quote so they render literally.
 * 2. Escapes embedded double-quotes for RFC-4180 quoting.
 */
export function csvSafeCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return guarded.replace(/"/g, '""');
}

/**
 * Quick CSV export for a snapshot's line items.
 */
export function exportSnapshotToCSV(snapshot: Snapshot) {
  let csv = 'Category,Type,Item Name,Currency,Amount,Excluded,GoalExcluded\n';
  snapshot.categories.forEach(cat => {
    cat.items.forEach(item => {
      const safeCatName  = csvSafeCell(cat.name);
      const safeItemName = csvSafeCell(item.name);
      csv += `"${safeCatName}","${cat.type}","${safeItemName}",${item.currency},${item.amount},${item.excludeFromNetWorth ? 'Yes' : 'No'},${item.excludeFromGoals ? 'Yes' : 'No'}\n`;
    });
  });
  return csv;
}

export type ExcelRow = Record<string, string | number | boolean | undefined>;

/**
 * Export a single snapshot to a two-sheet Excel workbook.
 * Sheet "Items": one row per line item with base-currency values.
 * Sheet "Summary": category totals + grand totals.
 */
export function exportSnapshotToExcel(snapshot: Snapshot, baseCurrency: string): void {
  const { categoryTotals, totalAssets, totalLiabilities, netWorth } = calcNetWorth(snapshot, baseCurrency);
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Items ---
  const asOf = monthEndDate(snapshot.month);
  const itemRows: ExcelRow[] = [];
  for (const cat of snapshot.categories) {
    for (const item of cat.items) {
      const baseValue = Math.round(convertToBase(item.amount, item.currency, baseCurrency, snapshot.exchangeRates));
      const inNetWorth = item.excludeFromNetWorth ? 'No' : 'Yes';
      const inGoals = (item.excludeFromNetWorth || item.excludeFromGoals) ? 'No' : 'Yes';
      const ret = annualisedReturn(item.purchasePrice, item.purchaseDate, item.amount, asOf);
      itemRows.push({
        'Category': cat.name,
        'Type': cat.type === 'asset' ? 'Asset' : 'Liability',
        'Item Name': item.name,
        'Currency': item.currency,
        'Amount': item.amount,
        [`Value (${baseCurrency})`]: baseValue,
        'Return % p.a.': ret !== null ? parseFloat((ret * 100).toFixed(1)) : undefined,
        'In Net Worth': inNetWorth,
        'In Goals': inGoals,
        'Notes': item.notes ?? '',
      });
    }
  }
  const wsItems = XLSX.utils.json_to_sheet(itemRows);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Items');

  // --- Sheet 2: Summary ---
  const summaryRows: ExcelRow[] = [];
  for (const cat of snapshot.categories) {
    const catTotal = Math.round(categoryTotals[cat.id] ?? 0);
    const itemCount = cat.items.filter(i => !i.excludeFromNetWorth).length;
    summaryRows.push({
      'Category': cat.name,
      'Type': cat.type === 'asset' ? 'Asset' : 'Liability',
      [`Total (${baseCurrency})`]: catTotal,
      'Items': itemCount,
    });
  }
  // Blank separator row
  summaryRows.push({ 'Category': '', 'Type': '', [`Total (${baseCurrency})`]: undefined, 'Items': undefined });
  // Grand totals
  summaryRows.push({ 'Category': 'Total Assets',      'Type': '', [`Total (${baseCurrency})`]: Math.round(totalAssets),      'Items': undefined });
  summaryRows.push({ 'Category': 'Total Liabilities', 'Type': '', [`Total (${baseCurrency})`]: Math.round(totalLiabilities), 'Items': undefined });
  summaryRows.push({ 'Category': 'Net Worth',          'Type': '', [`Total (${baseCurrency})`]: Math.round(netWorth),         'Items': undefined });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  XLSX.writeFile(wb, `snapshot-${snapshot.month}.xlsx`);
}

/**
 * Export all snapshots to a multi-sheet Excel workbook.
 * Sheet "Net Worth History": one row per snapshot sorted ascending.
 * Additional sheets (up to 30): item-level detail per snapshot.
 */
export function exportAllToExcel(snapshots: Snapshot[], baseCurrency: string): void {
  const sorted = [...snapshots].sort((a, b) => a.month.localeCompare(b.month));
  const wb = XLSX.utils.book_new();

  // --- Sheet: Net Worth History ---
  const historyRows: ExcelRow[] = sorted.map(snap => {
    const { totalAssets, totalLiabilities, netWorth } = calcNetWorth(snap, baseCurrency);
    const income = snap.monthlyIncome ?? 0;
    const expenses = snap.monthlyExpenses ?? 0;
    const savings = income - expenses;
    const savingsRate = income > 0 ? parseFloat((savings / income * 100).toFixed(1)) : 0;
    return {
      'Month': snap.month,
      [`Total Assets (${baseCurrency})`]: Math.round(totalAssets),
      [`Total Liabilities (${baseCurrency})`]: Math.round(totalLiabilities),
      [`Net Worth (${baseCurrency})`]: Math.round(netWorth),
      [`Monthly Income (${baseCurrency})`]: income > 0 ? Math.round(income) : undefined,
      [`Monthly Expenses (${baseCurrency})`]: expenses > 0 ? Math.round(expenses) : undefined,
      [`Monthly Savings (${baseCurrency})`]: income > 0 ? Math.round(savings) : undefined,
      'Savings Rate (%)': income > 0 ? savingsRate : undefined,
      'Notes': snap.notes ?? '',
    };
  });
  const wsHistory = XLSX.utils.json_to_sheet(historyRows);
  XLSX.utils.book_append_sheet(wb, wsHistory, 'Net Worth History');

  // --- Sheet: Returns (per-account annualised return, latest snapshot) ---
  // Built from the most recent snapshot so the RM sees current values. Only
  // accounts with a recorded cost basis appear; CAGR is blank when there's no
  // purchase date or the holding period hasn't started yet.
  const latest = sorted[sorted.length - 1];
  if (latest) {
    const returnRows: ExcelRow[] = buildAccountReturns(latest, baseCurrency).map(r => ({
      'Category': r.category,
      'Account': r.account,
      'Currency': r.currency,
      'Purchase Date': r.purchaseDate,
      [`Purchase Price (${r.currency})`]: r.purchasePrice,
      [`Current Value (${baseCurrency})`]: r.currentValueBase,
      [`Cost Basis (${baseCurrency})`]: r.costBasisBase,
      [`Unrealised Gain (${baseCurrency})`]: r.unrealisedGainBase,
      'Total Return %': r.totalReturnPct,
      'Annualised Return % (CAGR)': r.annualisedReturnPct ?? undefined,
    }));
    if (returnRows.length > 0) {
      // Caption so the sheet stands on its own when shared with an adviser who
      // doesn't have the app's context — states the basis and its limitation.
      const caption = [[
        `Annualised return (CAGR) per account, purchase date → ${latest.month}. ` +
        `Point-to-point: excludes the timing of any money added (SIPs) or withdrawn in between. ` +
        `Accounts without a recorded cost basis are not listed.`,
      ]];
      const wsReturns = XLSX.utils.aoa_to_sheet(caption);
      XLSX.utils.sheet_add_json(wsReturns, returnRows, { origin: 'A3' });
      XLSX.utils.book_append_sheet(wb, wsReturns, 'Returns');
    }
  }

  // --- Detail sheets: up to 30 snapshots (oldest first) ---
  const detailSnaps = sorted.slice(0, 30);
  for (const snap of detailSnaps) {
    const hasItems = snap.categories.some(cat => cat.items.length > 0);
    if (!hasItems) continue;

    const asOf = monthEndDate(snap.month);
    const itemRows: ExcelRow[] = [];
    for (const cat of snap.categories) {
      for (const item of cat.items) {
        const baseValue = Math.round(convertToBase(item.amount, item.currency, baseCurrency, snap.exchangeRates));
        const inNetWorth = item.excludeFromNetWorth ? 'No' : 'Yes';
        const inGoals = (item.excludeFromNetWorth || item.excludeFromGoals) ? 'No' : 'Yes';
        const ret = annualisedReturn(item.purchasePrice, item.purchaseDate, item.amount, asOf);
        itemRows.push({
          'Category': cat.name,
          'Type': cat.type === 'asset' ? 'Asset' : 'Liability',
          'Item Name': item.name,
          'Currency': item.currency,
          'Amount': item.amount,
          [`Value (${baseCurrency})`]: baseValue,
          'Return % p.a.': ret !== null ? parseFloat((ret * 100).toFixed(1)) : undefined,
          'In Net Worth': inNetWorth,
          'In Goals': inGoals,
          'Notes': item.notes ?? '',
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(itemRows);
    // Sheet names must be <= 31 chars; YYYY-MM is 7 chars — safe
    XLSX.utils.book_append_sheet(wb, ws, snap.month);
  }

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `wealthpulse-history-${today}.xlsx`);
}

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
