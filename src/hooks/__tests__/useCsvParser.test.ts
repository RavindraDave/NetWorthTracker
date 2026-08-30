import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { normalize, autoDetect, isExcelFile, CSV_FIELDS, CSV_FIELD_HINTS } from '../useCsvParser';

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

describe('normalize', () => {
  it('lowercases the string', () => {
    expect(normalize('ItemName')).toBe('itemname');
  });

  it('strips spaces', () => {
    expect(normalize('Item Name')).toBe('itemname');
  });

  it('strips underscores', () => {
    expect(normalize('item_name')).toBe('itemname');
  });

  it('strips parentheses', () => {
    expect(normalize('amount(USD)')).toBe('amountusd');
  });

  it('strips hyphens', () => {
    expect(normalize('closing-balance')).toBe('closingbalance');
  });

  it('strips dots', () => {
    expect(normalize('curr.code')).toBe('currcode');
  });

  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// autoDetect
// ---------------------------------------------------------------------------

describe('autoDetect', () => {
  it('detects "Item Name" from "name" header', () => {
    const mapping = autoDetect(['name', 'amount']);
    expect(mapping['Item Name']).toBe('name');
  });

  it('detects "Amount" from "balance" header', () => {
    const mapping = autoDetect(['description', 'balance']);
    expect(mapping['Amount']).toBe('balance');
  });

  it('detects "Currency" from "ccy" header', () => {
    const mapping = autoDetect(['item', 'value', 'ccy']);
    expect(mapping['Currency']).toBe('ccy');
  });

  it('detects "Category" from "group" header', () => {
    const mapping = autoDetect(['item', 'amount', 'group']);
    expect(mapping['Category']).toBe('group');
  });

  it('detects "Type" from "type" header', () => {
    const mapping = autoDetect(['name', 'amt', 'type']);
    expect(mapping['Type']).toBe('type');
  });

  it('ignores unrecognised headers', () => {
    const mapping = autoDetect(['foo', 'bar', 'baz']);
    expect(Object.keys(mapping)).toHaveLength(0);
  });

  it('detects multiple fields at once', () => {
    const headers = ['description', 'currentvalue', 'currencycode', 'category', 'kind'];
    const mapping = autoDetect(headers);
    expect(mapping['Item Name']).toBe('description');
    expect(mapping['Amount']).toBe('currentvalue');
    expect(mapping['Currency']).toBe('currencycode');
    expect(mapping['Category']).toBe('category');
    expect(mapping['Type']).toBe('kind');
  });

  it('returns empty mapping for empty headers', () => {
    expect(autoDetect([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// isExcelFile + Excel round-trip through the shared import path
// ---------------------------------------------------------------------------

describe('isExcelFile', () => {
  it('detects .xlsx by extension regardless of MIME', () => {
    expect(isExcelFile(new File([''], 'snapshot-2026-07.xlsx'))).toBe(true);
    expect(isExcelFile(new File([''], 'DATA.XLSX'))).toBe(true);
  });

  it('detects Excel by MIME type', () => {
    const f = new File([''], 'export', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(isExcelFile(f)).toBe(true);
  });

  it('treats .csv files as non-Excel', () => {
    expect(isExcelFile(new File([''], 'statement.csv', { type: 'text/csv' }))).toBe(false);
  });
});

describe("Excel import round-trip of the app's own export headers", () => {
  it('parses an xlsx workbook (array type) and auto-detects the export columns', () => {
    // Same headers exportSnapshotToExcel writes to the Items sheet
    const rows = [
      { 'Category': 'Cash & Bank', 'Type': 'Asset', 'Item Name': 'HDFC Savings', 'Currency': 'INR', 'Amount': 250000 },
      { 'Category': 'Loans', 'Type': 'Liability', 'Item Name': 'Home Loan', 'Currency': 'INR', 'Amount': 4200000 },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    // Mirror the hook's Excel branch: Uint8Array + type 'array'
    const parsedWb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const parsed = XLSX.utils.sheet_to_json<Record<string, string>>(parsedWb.Sheets[parsedWb.SheetNames[0]], { defval: '' });

    expect(parsed).toHaveLength(2);
    expect(String(parsed[0]['Item Name'])).toBe('HDFC Savings');

    const mapping = autoDetect(Object.keys(parsed[0]));
    expect(mapping['Item Name']).toBe('Item Name');
    expect(mapping['Category']).toBe('Category');
    expect(mapping['Amount']).toBe('Amount');
    expect(mapping['Currency']).toBe('Currency');
    expect(mapping['Type']).toBe('Type');
  });
});

// ---------------------------------------------------------------------------
// CSV_FIELDS / CSV_FIELD_HINTS
// ---------------------------------------------------------------------------

describe('CSV_FIELDS', () => {
  it('contains the seven expected field names', () => {
    expect(CSV_FIELDS).toEqual(
      ['Item Name', 'Category', 'Sub-Category', 'Amount', 'Currency', 'Type', 'Notes']);
  });
});

describe('CSV_FIELD_HINTS', () => {
  it('marks Item Name and Amount as required', () => {
    expect(CSV_FIELD_HINTS['Item Name']).toBe('required');
    expect(CSV_FIELD_HINTS['Amount']).toBe('required');
  });

  it('marks Category, Sub-Category, Currency, and Type as optional', () => {
    expect(CSV_FIELD_HINTS['Category']).toBe('optional');
    expect(CSV_FIELD_HINTS['Sub-Category']).toBe('optional');
    expect(CSV_FIELD_HINTS['Currency']).toBe('optional');
    expect(CSV_FIELD_HINTS['Type']).toBe('optional');
  });
});

describe('autoDetect — Sub-Category', () => {
  it('round-trips our own export header', () => {
    // exportSnapshotToCSV writes "Sub-Category"; normalize() makes it 'subcategory'.
    const m = autoDetect(['Category', 'Sub-Category', 'Item Name', 'Amount']);
    expect(m['Sub-Category']).toBe('Sub-Category');
    expect(m['Category']).toBe('Category');
  });

  it('accepts common spellings', () => {
    expect(autoDetect(['Sub Category'])['Sub-Category']).toBe('Sub Category');
    expect(autoDetect(['sub_group'])['Sub-Category']).toBe('sub_group');
    expect(autoDetect(['SubType'])['Sub-Category']).toBe('SubType');
  });

  it('does not confuse Group with Sub-Group', () => {
    const m = autoDetect(['Group', 'Sub Group']);
    expect(m['Category']).toBe('Group');
    expect(m['Sub-Category']).toBe('Sub Group');
  });

  /**
   * In a broker or mutual-fund statement these name the individual HOLDING, not a
   * grouping. Claiming them would file every item name into the group column.
   */
  it('never claims holding-name headers like Scheme Name or Fund Name', () => {
    expect(autoDetect(['Scheme Name'])['Sub-Category']).toBeUndefined();
    expect(autoDetect(['Fund Name'])['Sub-Category']).toBeUndefined();
    expect(autoDetect(['Instrument'])['Sub-Category']).toBeUndefined();
  });

  it('leaves Sub-Category unmapped when no such column exists', () => {
    expect(autoDetect(['Name', 'Amount', 'Currency'])['Sub-Category']).toBeUndefined();
  });
});
