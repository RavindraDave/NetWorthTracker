import { Snapshot, Goal, UserPreferences, BackupData, Category, LineItem } from '../types';
import * as XLSX from 'xlsx';
import { calcNetWorth, convertToBase, calcSavingsRate, anchorRate } from './calculations';
import { buildAccountReturns, itemReturnPct, monthEndDate } from './returns';

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

/** Build exchange rate rows for foreign currencies actually used in a snapshot. */
export function buildExchangeRateRows(snapshot: Snapshot, baseCurrency: string): ExcelRow[] {
  const usedCurrencies = Array.from(
    new Set(
      snapshot.categories.flatMap(cat =>
        cat.items
          .filter(i => !i.excludeFromNetWorth && i.currency !== baseCurrency)
          .map(i => i.currency)
      )
    )
  ).sort();

  if (usedCurrencies.length === 0) return [];

  const asOf = snapshot.ratesLastUpdated
    ? new Date(snapshot.ratesLastUpdated).toISOString().split('T')[0]
    : '';

  const rates = snapshot.exchangeRates ?? {};
  const baseRate = anchorRate(baseCurrency, rates);
  return usedCurrencies.map(currency => {
    const currRate = anchorRate(currency, rates);
    const displayRate = baseRate > 0 && currRate > 0 ? baseRate / currRate : undefined;
    return {
      'Currency': currency,
      [`Rate (1 ${currency} → ${baseCurrency})`]: displayRate,
      'Rates As Of': asOf,
    };
  });
}

/**
 * One row of the item-level detail layout, shared by the single-snapshot "Items"
 * sheet and the per-month detail sheets in the history workbook. Both used to carry
 * their own copy of this object literal; keep it in one place so a column added here
 * lands in both sheets.
 *
 * Every key is emitted unconditionally — `json_to_sheet` derives the header row from
 * key insertion order, so a conditionally-omitted key shifts that row's columns.
 */
export function buildItemRow(
  cat: Category,
  item: LineItem,
  snapshot: Snapshot,
  baseCurrency: string,
  asOf: Date,
): ExcelRow {
  const baseValue = Math.round(convertToBase(item.amount, item.currency, baseCurrency, snapshot.exchangeRates));
  return {
    'Category': cat.name,
    'Type': cat.type === 'asset' ? 'Asset' : 'Liability',
    'Item Name': item.name,
    'Currency': item.currency,
    'Amount': item.amount,
    [`Value (${baseCurrency})`]: baseValue,
    'Return % p.a.': itemReturnPct(item, asOf),
    'In Net Worth': item.excludeFromNetWorth ? 'No' : 'Yes',
    'In Goals': (item.excludeFromNetWorth || item.excludeFromGoals) ? 'No' : 'Yes',
    'Notes': item.notes ?? '',
  };
}

/**
 * Export a single snapshot to a three-sheet Excel workbook.
 * Sheet "Items": one row per line item with base-currency values.
 * Sheet "Summary": category totals + grand totals.
 * Sheet "Exchange Rates": rates used for currency conversion.
 */
export function exportSnapshotToExcel(snapshot: Snapshot, baseCurrency: string): void {
  const { categoryTotals, totalAssets, totalLiabilities, netWorth } = calcNetWorth(snapshot, baseCurrency);
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Items ---
  const asOf = monthEndDate(snapshot.month);
  const itemRows: ExcelRow[] = [];
  for (const cat of snapshot.categories) {
    for (const item of cat.items) {
      itemRows.push(buildItemRow(cat, item, snapshot, baseCurrency, asOf));
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

  // --- Sheet 3: Exchange Rates ---
  const rateRows = buildExchangeRateRows(snapshot, baseCurrency);
  if (rateRows.length > 0) {
    const wsRates = XLSX.utils.json_to_sheet(rateRows);
    XLSX.utils.book_append_sheet(wb, wsRates, 'Exchange Rates');
  }

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
    const savingsRate = parseFloat(calcSavingsRate(income, expenses).toFixed(1));
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

  // --- Sheet: Exchange Rates (all snapshots, one row per currency per month) ---
  const allRateRows: ExcelRow[] = sorted.flatMap(snap => {
    const rows = buildExchangeRateRows(snap, baseCurrency);
    return rows.map(r => ({ 'Month': snap.month, ...r }));
  });
  if (allRateRows.length > 0) {
    const wsRates = XLSX.utils.json_to_sheet(allRateRows);
    XLSX.utils.book_append_sheet(wb, wsRates, 'Exchange Rates');
  }

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
      [`Current Value (${baseCurrency})`]: r.currentValueBase,
      'Return % p.a.': r.returnRatePct,
      'Basis': r.basis,
      'Purchase Date': r.purchaseDate ?? '',
      'Purchase Price': r.purchasePrice ?? undefined,
      [`Cost Basis (${baseCurrency})`]: r.costBasisBase ?? undefined,
      [`Unrealised Gain (${baseCurrency})`]: r.unrealisedGainBase ?? undefined,
      'Total Return %': r.totalReturnPct ?? undefined,
    }));
    if (returnRows.length > 0) {
      // Caption so the sheet stands on its own when shared with an adviser who
      // doesn't have the app's context — states the basis and its limitation.
      const caption = [[
        `Annual return % per account as of ${latest.month}. ` +
        `Basis "Stated" = a known fixed yield you entered (savings, FD, bonds). ` +
        `Basis "CAGR" = measured from cost basis to current value, point-to-point ` +
        `(excludes the timing of money added/withdrawn, e.g. SIPs). ` +
        `Accounts with neither a stated rate nor a cost basis are not listed.`,
      ]];
      const wsReturns = XLSX.utils.aoa_to_sheet(caption);
      XLSX.utils.sheet_add_json(wsReturns, returnRows, { origin: 'A3' });
      XLSX.utils.book_append_sheet(wb, wsReturns, 'Returns');
    }
  }

  // --- Detail sheets: up to 30 most-recent snapshots ---
  const detailSnaps = sorted.slice(-30);
  for (const snap of detailSnaps) {
    const hasItems = snap.categories.some(cat => cat.items.length > 0);
    if (!hasItems) continue;

    const asOf = monthEndDate(snap.month);
    const itemRows: ExcelRow[] = [];
    for (const cat of snap.categories) {
      for (const item of cat.items) {
        itemRows.push(buildItemRow(cat, item, snap, baseCurrency, asOf));
      }
    }

    const ws = XLSX.utils.json_to_sheet(itemRows);
    // Sheet names must be <= 31 chars; YYYY-MM is 7 chars — safe
    XLSX.utils.book_append_sheet(wb, ws, snap.month);
  }

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `wealthpulse-history-${today}.xlsx`);
}
