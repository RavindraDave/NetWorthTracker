/**
 * Sample import file for the CSV/Excel column mapper. The header row is
 * derived from `CSV_FIELDS` — the same array the mapper's auto-detect reads
 * from — rather than a hand-typed duplicate, so this can't silently drift
 * from what the mapper actually expects if a field is ever added or renamed.
 */
import * as XLSX from 'xlsx';
import { CsvFieldName } from '../types';
import { CSV_FIELDS } from '../hooks/useCsvParser';
import { downloadFile } from './importExport';

/**
 * Generic, currency-neutral examples that exercise every optional column
 * (Sub-Category, Currency, Type, Notes) at least once — not just the two
 * required fields — so the template teaches the schema, not just the
 * minimum needed to pass validation.
 */
const SAMPLE_ROWS: Record<CsvFieldName, string>[] = [
  { 'Item Name': 'Checking Account', 'Category': 'Cash & Bank',  'Sub-Category': '',         'Amount': '5000',  'Currency': 'USD', 'Type': 'asset',     'Notes': '' },
  { 'Item Name': 'Savings Account',  'Category': 'Cash & Bank',  'Sub-Category': '',         'Amount': '10000', 'Currency': 'EUR', 'Type': 'asset',     'Notes': 'Emergency fund' },
  { 'Item Name': 'US Stocks',        'Category': 'Investments',  'Sub-Category': 'Brokerage','Amount': '25000', 'Currency': 'USD', 'Type': 'asset',     'Notes': '' },
  { 'Item Name': 'Credit Card',      'Category': 'Credit Cards', 'Sub-Category': '',         'Amount': '1200',  'Currency': 'USD', 'Type': 'liability', 'Notes': '' },
  { 'Item Name': 'Car Loan',         'Category': 'Loans',        'Sub-Category': '',         'Amount': '8000',  'Currency': 'USD', 'Type': 'liability', 'Notes': '' },
];

function escapeCsvValue(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Exported for testing — the header row is the guarantee this file exists to keep. */
export function buildSampleCsv(): string {
  const lines = [CSV_FIELDS.join(',')];
  for (const row of SAMPLE_ROWS) {
    lines.push(CSV_FIELDS.map(f => escapeCsvValue(row[f])).join(','));
  }
  return lines.join('\n');
}

export function downloadSampleCsv(): void {
  downloadFile(buildSampleCsv(), 'wealthpulse-sample-import.csv', 'text/csv');
}

export function downloadSampleExcel(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: CSV_FIELDS });
  XLSX.utils.book_append_sheet(wb, ws, 'Sample Import');
  XLSX.writeFile(wb, 'wealthpulse-sample-import.xlsx');
}
