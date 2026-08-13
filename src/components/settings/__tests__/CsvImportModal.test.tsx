import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CsvImportModal } from '../CsvImportModal';
import type { Snapshot, UserPreferences, Category } from '../../../types';

// ── Top-level mocks ────────────────────────────────────────────────────────

// Hoisted so tests can inspect what the import actually persisted.
const mocks = vi.hoisted(() => ({ saveSnapshot: vi.fn() }));

vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({
    snapshots: [] as Snapshot[],
    preferences: {
      baseCurrency: 'INR',
      enabledCurrencies: ['INR', 'USD'],
      csvMappingProfiles: {},
    } as UserPreferences,
    createNewSnapshot: () => ({
      id: 'new',
      month: '2026-06',
      categories: [],
      exchangeRates: {},
      updatedAt: new Date().toISOString(),
    }),
    saveSnapshot: mocks.saveSnapshot,
    updatePreferences: vi.fn(),
  }),
}));

vi.mock('../../common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../common/Modal', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
}));

// XLSX mock — sheet_to_json is controlled per-test via __setRows
const sheetRows: { current: Record<string, string>[] } = { current: [] };
vi.mock('xlsx', () => ({
  read: vi.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } })),
  utils: {
    sheet_to_json: vi.fn(() => sheetRows.current),
  },
}));

// ── FileReader mock ────────────────────────────────────────────────────────

class MockFileReader {
  result: string = '';
  onload: ((e: Partial<ProgressEvent<FileReader>>) => void) | null = null;
  onerror: (() => void) | null = null;
  readAsText(_: Blob) {
    // Fire onload synchronously so state updates happen before assertions
    this.onload?.({ target: this as unknown as FileReader } as Partial<ProgressEvent<FileReader>>);
  }
}
// @ts-expect-error - override global FileReader with a synchronous stub
global.FileReader = MockFileReader;

// ── Helper ─────────────────────────────────────────────────────────────────

function renderModal(rows: Record<string, string>[]) {
  sheetRows.current = rows;
  const file = new File([''], 'test.csv', { type: 'text/csv' });
  return render(<CsvImportModal file={file} onClose={vi.fn()} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CsvImportModal — column auto-detection', () => {
  beforeEach(() => {
    sheetRows.current = [];
  });

  it('auto-detects "Amount" from a column named "Balance"', async () => {
    renderModal([{ Name: 'Savings', Balance: '50000', Ccy: 'INR', Type: 'asset' }]);
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const amountSelect = selects.find(s => (s as HTMLSelectElement).value === 'Balance');
      expect(amountSelect).toBeDefined();
    });
  });

  it('auto-detects "Item Name" from a column named "Name"', async () => {
    renderModal([{ Name: 'Savings', Amount: '50000', Currency: 'INR' }]);
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const nameSelect = selects.find(s => (s as HTMLSelectElement).value === 'Name');
      expect(nameSelect).toBeDefined();
    });
  });

  it('auto-detects "Currency" from a column named "Ccy"', async () => {
    renderModal([{ ItemName: 'Savings', Amount: '50000', Ccy: 'INR' }]);
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const ccySelect = selects.find(s => (s as HTMLSelectElement).value === 'Ccy');
      expect(ccySelect).toBeDefined();
    });
  });

  it('shows preview rows from the CSV', async () => {
    renderModal([
      { Name: 'Savings', Balance: '50000' },
      { Name: 'Fixed Deposit', Balance: '100000' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Savings')).toBeInTheDocument();
      expect(screen.getByText('Fixed Deposit')).toBeInTheDocument();
    });
  });

  it('disables Import button when required columns are not mapped', () => {
    renderModal([{ Foo: 'bar' }]);
    const importBtn = screen.getByRole('button', { name: /import/i });
    expect(importBtn).toBeDisabled();
  });
});

// ── Sub-category import ────────────────────────────────────────────────────

describe('CsvImportModal — sub-categories', () => {
  beforeEach(() => {
    sheetRows.current = [];
    mocks.saveSnapshot.mockClear();
  });

  /** Run the import and return the snapshot that was persisted. */
  async function importRows(rows: Record<string, string>[]) {
    renderModal(rows);
    const importBtn = await screen.findByRole('button', { name: /import/i });
    await waitFor(() => expect(importBtn).not.toBeDisabled());
    fireEvent.click(importBtn);
    await waitFor(() => expect(mocks.saveSnapshot).toHaveBeenCalled());
    return mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
  }

  const findCat = (snap: Snapshot, name: string) =>
    snap.categories.find(c => c.name === name) as Category;

  /**
   * The round-trip that matters: exportSnapshotToCSV writes these exact headers,
   * so a file this app produced must import back with its grouping intact.
   */
  it('round-trips our own export headers, creating groups and filing items', async () => {
    const snap = await importRows([
      { 'Category': 'Investments', 'Sub-Category': 'Mutual Funds', 'Item Name': 'Fund A', 'Amount': '1000', 'Currency': 'INR' },
      { 'Category': 'Investments', 'Sub-Category': 'Mutual Funds', 'Item Name': 'Fund B', 'Amount': '2000', 'Currency': 'INR' },
      { 'Category': 'Investments', 'Sub-Category': 'Stocks', 'Item Name': 'Reliance', 'Amount': '500', 'Currency': 'INR' },
    ]);

    const inv = findCat(snap, 'Investments');
    expect(inv.subCategories?.map(s => s.name)).toEqual(['Mutual Funds', 'Stocks']);

    const mfId = inv.subCategories!.find(s => s.name === 'Mutual Funds')!.id;
    expect(inv.items.filter(i => i.subCategoryId === mfId)).toHaveLength(2);
    expect(inv.items).toHaveLength(3);
  });

  it('reuses one group for names differing only by case or spacing', async () => {
    const snap = await importRows([
      { 'Category': 'Investments', 'Sub-Category': 'Mutual Funds', 'Item Name': 'Fund A', 'Amount': '1000' },
      { 'Category': 'Investments', 'Sub-Category': '  mutual   FUNDS ', 'Item Name': 'Fund B', 'Amount': '2000' },
    ]);

    const inv = findCat(snap, 'Investments');
    expect(inv.subCategories).toHaveLength(1);
    expect(inv.items.every(i => i.subCategoryId === inv.subCategories![0].id)).toBe(true);
  });

  /** The sin the old Excel path committed: dropping rows that didn't match. */
  it('imports every row, blank sub-category or not, and never invents a group', async () => {
    const snap = await importRows([
      { 'Category': 'Investments', 'Sub-Category': 'Mutual Funds', 'Item Name': 'Fund A', 'Amount': '1000' },
      { 'Category': 'Investments', 'Sub-Category': '', 'Item Name': 'Loose holding', 'Amount': '300' },
      { 'Category': 'Investments', 'Sub-Category': '   ', 'Item Name': 'Another loose', 'Amount': '200' },
    ]);

    const inv = findCat(snap, 'Investments');
    expect(inv.items).toHaveLength(3);
    expect(inv.subCategories).toHaveLength(1); // no "Uncategorised" invented
    expect(inv.items.filter(i => !i.subCategoryId)).toHaveLength(2);
  });

  it('keeps same-named groups separate across different categories', async () => {
    const snap = await importRows([
      { 'Category': 'Investments', 'Sub-Category': 'Bonds', 'Item Name': 'SGB', 'Amount': '1000' },
      { 'Category': 'Retirement', 'Sub-Category': 'Bonds', 'Item Name': 'NPS-G', 'Amount': '2000' },
    ]);

    const inv = findCat(snap, 'Investments');
    const ret = findCat(snap, 'Retirement');
    expect(inv.subCategories![0].id).not.toBe(ret.subCategories![0].id);
  });

  it('leaves items ungrouped when the column is not mapped at all', async () => {
    const snap = await importRows([
      { 'Category': 'Investments', 'Item Name': 'Fund A', 'Amount': '1000' },
    ]);

    const inv = findCat(snap, 'Investments');
    expect(inv.subCategories).toBeUndefined();
    expect(inv.items[0].subCategoryId).toBeUndefined();
  });
});
