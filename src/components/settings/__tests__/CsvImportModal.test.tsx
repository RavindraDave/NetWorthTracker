import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CsvImportModal } from '../CsvImportModal';
import type { Snapshot, UserPreferences, Category } from '../../../types';

// ── Top-level mocks ────────────────────────────────────────────────────────

// Hoisted so tests can inspect what the import actually persisted, and control
// snapshots/preferences/toast behaviour per test.
const mocks = vi.hoisted(() => ({
  saveSnapshot: vi.fn(),
  updatePreferences: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  navigate: vi.fn(),
  snapshots: [] as Snapshot[],
  preferences: {
    baseCurrency: 'INR',
    enabledCurrencies: ['INR', 'USD'],
    csvMappingProfiles: {},
  } as UserPreferences,
}));

vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({
    snapshots: mocks.snapshots,
    preferences: mocks.preferences,
    createNewSnapshot: () => ({
      id: 'new',
      month: '2026-06',
      categories: [],
      exchangeRates: {},
      updatedAt: new Date().toISOString(),
    }),
    saveSnapshot: mocks.saveSnapshot,
    updatePreferences: mocks.updatePreferences,
  }),
}));

vi.mock('../../common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error, confirm: mocks.confirm }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
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
  readAsArrayBuffer(_: Blob) {
    this.onload?.({ target: this as unknown as FileReader } as Partial<ProgressEvent<FileReader>>);
  }
}
// @ts-expect-error - override global FileReader with a synchronous stub
global.FileReader = MockFileReader;

beforeEach(() => {
  mocks.snapshots = [];
  mocks.preferences = { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'], csvMappingProfiles: {} } as UserPreferences;
  mocks.saveSnapshot.mockClear();
  mocks.updatePreferences.mockClear();
  mocks.success.mockClear();
  mocks.error.mockClear();
  mocks.confirm.mockClear();
  mocks.confirm.mockResolvedValue(true);
  mocks.navigate.mockClear();
});

// ── Helper ─────────────────────────────────────────────────────────────────

function renderModal(rows: Record<string, string>[], fileName = 'test.csv') {
  sheetRows.current = rows;
  const file = new File([''], fileName, { type: 'text/csv' });
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

// ── Month picker & conflicts ────────────────────────────────────────────────

describe('CsvImportModal — target month', () => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  it('disables Import and shows a warning when the user picks a month with an existing snapshot', async () => {
    mocks.snapshots = [{ id: 's1', month: currentMonth, categories: [], exchangeRates: {}, createdAt: '', updatedAt: '' } as Snapshot];
    renderModal([{ Name: 'Savings', Amount: '1000' }]);
    await screen.findByRole('button', { name: /import/i });
    const monthInput = document.querySelector('input[type="month"]') as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: currentMonth } });
    await waitFor(() => screen.getByText(/already exists for this month/i));
    expect(screen.getByRole('button', { name: /import/i })).toBeDisabled();
  });

  it('re-enables Import once the month is changed away from the conflict', async () => {
    mocks.snapshots = [{ id: 's1', month: currentMonth, categories: [], exchangeRates: {}, createdAt: '', updatedAt: '' } as Snapshot];
    renderModal([{ Name: 'Savings', Amount: '1000' }]);
    await screen.findByRole('button', { name: /import/i });
    const monthInput = document.querySelector('input[type="month"]') as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: currentMonth } });
    await waitFor(() => screen.getByText(/already exists for this month/i));
    fireEvent.change(monthInput, { target: { value: '2099-07' } });
    expect(screen.queryByText(/already exists for this month/i)).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: /import/i })).not.toBeDisabled());
  });
});

// ── Mapping profiles UI ─────────────────────────────────────────────────────

describe('CsvImportModal — mapping profile UI', () => {
  it('lists saved profiles and applies one on click', async () => {
    mocks.preferences = {
      baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'],
      csvMappingProfiles: { 'My mapping': { 'Item Name': 'Name' } },
    } as unknown as UserPreferences;
    renderModal([{ Name: 'Savings', Balance: '1000' }]);
    await waitFor(() => screen.getByText('My mapping'));
    fireEvent.click(screen.getByText('My mapping'));
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects.some(s => s.value === 'Name')).toBe(true);
  });

  it('deletes a saved profile after confirming', async () => {
    mocks.preferences = {
      baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'],
      csvMappingProfiles: { 'My mapping': { 'Item Name': 'Name' } },
    } as unknown as UserPreferences;
    renderModal([{ Name: 'Savings', Balance: '1000' }]);
    await waitFor(() => screen.getByText('My mapping'));
    fireEvent.click(screen.getByLabelText('Delete mapping My mapping'));
    await waitFor(() => expect(mocks.updatePreferences).toHaveBeenCalledWith({ csvMappingProfiles: {} }));
  });

  it('does not delete the profile when the user declines the confirm', async () => {
    mocks.confirm.mockResolvedValue(false);
    mocks.preferences = {
      baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'],
      csvMappingProfiles: { 'My mapping': { 'Item Name': 'Name' } },
    } as unknown as UserPreferences;
    renderModal([{ Name: 'Savings', Balance: '1000' }]);
    await waitFor(() => screen.getByText('My mapping'));
    fireEvent.click(screen.getByLabelText('Delete mapping My mapping'));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
  });

  it('Save mapping is disabled until the required fields are mapped', async () => {
    renderModal([{ Foo: 'bar' }]);
    await waitFor(() => screen.getByRole('button', { name: /save mapping/i }));
    expect(screen.getByRole('button', { name: /save mapping/i })).toBeDisabled();
  });

  it('saves a new named mapping profile', async () => {
    renderModal([{ Name: 'Savings', Balance: '1000' }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /save mapping/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /save mapping/i }));
    fireEvent.change(screen.getByLabelText('Name for this mapping'), { target: { value: 'Bank export' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.updatePreferences).toHaveBeenCalledWith({
      csvMappingProfiles: expect.objectContaining({ 'Bank export': expect.any(Object) }),
    }));
    expect(screen.queryByLabelText('Name for this mapping')).toBeNull();
  });

  it('cancels the save-mapping form without persisting anything', async () => {
    renderModal([{ Name: 'Savings', Balance: '1000' }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /save mapping/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /save mapping/i }));
    fireEvent.change(screen.getByLabelText('Name for this mapping'), { target: { value: 'Discard me' } });
    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Name for this mapping')).toBeNull();
  });

  it('asks to confirm before overwriting an existing profile name, and respects a decline', async () => {
    mocks.preferences = {
      baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'],
      csvMappingProfiles: { Existing: {} },
    } as unknown as UserPreferences;
    mocks.confirm.mockResolvedValue(false);
    renderModal([{ Name: 'Savings', Balance: '1000' }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /save mapping/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /save mapping/i }));
    fireEvent.change(screen.getByLabelText('Name for this mapping'), { target: { value: 'Existing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
  });

  it('submits the save-mapping form on Enter in the name field', async () => {
    renderModal([{ Name: 'Savings', Balance: '1000' }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /save mapping/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /save mapping/i }));
    const input = screen.getByLabelText('Name for this mapping');
    fireEvent.change(input, { target: { value: 'Via enter' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(mocks.updatePreferences).toHaveBeenCalled());
  });
});

// ── Import execution branches ───────────────────────────────────────────────

describe('CsvImportModal — import execution', () => {
  async function importAndWait(rows: Record<string, string>[]) {
    renderModal(rows);
    const importBtn = await screen.findByRole('button', { name: /import/i });
    await waitFor(() => expect(importBtn).not.toBeDisabled());
    fireEvent.click(importBtn);
    await waitFor(() => expect(mocks.saveSnapshot).toHaveBeenCalled());
  }

  it('defaults an unmapped Category column to "Cash & Bank"', async () => {
    await importAndWait([{ 'Item Name': 'Wallet', Amount: '100' }]);
    const snap = mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
    expect(snap.categories[0].name).toBe('Cash & Bank');
  });

  it('falls back to a blank Category cell as "Cash & Bank" too', async () => {
    await importAndWait([{ 'Category': '', 'Item Name': 'Wallet', Amount: '100' }]);
    const snap = mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
    expect(snap.categories[0].name).toBe('Cash & Bank');
  });

  it('reads Type "liability" into a liability category', async () => {
    await importAndWait([{ 'Category': 'Loans', 'Item Name': 'Home Loan', Amount: '100', Type: 'liability' }]);
    const snap = mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
    expect(snap.categories[0].type).toBe('liability');
  });

  it('falls back to the base currency for a currency code the user has not enabled', async () => {
    await importAndWait([{ 'Item Name': 'Wallet', Amount: '100', Currency: 'ZZZ' }]);
    const snap = mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
    expect(snap.categories[0].items[0].currency).toBe('INR');
  });

  it('keeps an enabled non-base currency as-is', async () => {
    await importAndWait([{ 'Item Name': 'Wallet', Amount: '100', Currency: 'USD' }]);
    const snap = mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
    expect(snap.categories[0].items[0].currency).toBe('USD');
  });

  it('carries a mapped Notes column onto the item', async () => {
    await importAndWait([{ 'Item Name': 'Wallet', Amount: '100', Notes: 'from bank export' }]);
    const snap = mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
    expect(snap.categories[0].items[0].notes).toBe('from bank export');
  });

  it('falls back to "Imported Item" for a blank name and passes the count through navigation state', async () => {
    await importAndWait([{ 'Item Name': '', Amount: '100' }]);
    const snap = mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
    expect(snap.categories[0].items[0].name).toBe('Imported Item');
    expect(mocks.navigate).toHaveBeenCalledWith(
      `/editor/${snap.id}`,
      expect.objectContaining({ state: expect.objectContaining({
        importSummary: expect.objectContaining({ missingNameCount: 1 }),
      }) })
    );
  });

  it('counts an unparseable amount and clamps it to zero rather than crashing', async () => {
    await importAndWait([{ 'Item Name': 'Odd', Amount: '???' }]);
    const snap = mocks.saveSnapshot.mock.calls[0][0] as Snapshot;
    expect(snap.categories[0].items[0].amount).toBe(0);
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ state: expect.objectContaining({
        importSummary: expect.objectContaining({ badAmountCount: 1 }),
      }) })
    );
  });

  it('shows an error toast and stays open when saveSnapshot rejects', async () => {
    mocks.saveSnapshot.mockRejectedValueOnce(new Error('disk full'));
    renderModal([{ 'Item Name': 'Wallet', Amount: '100' }]);
    const importBtn = await screen.findByRole('button', { name: /import/i });
    await waitFor(() => expect(importBtn).not.toBeDisabled());
    fireEvent.click(importBtn);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Import failed')));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('shows "Importing…" while the import is in flight', async () => {
    let resolveSave: () => void = () => {};
    mocks.saveSnapshot.mockReturnValueOnce(new Promise<void>(resolve => { resolveSave = resolve; }));
    renderModal([{ 'Item Name': 'Wallet', Amount: '100' }]);
    const importBtn = await screen.findByRole('button', { name: /import/i });
    await waitFor(() => expect(importBtn).not.toBeDisabled());
    fireEvent.click(importBtn);
    await waitFor(() => expect(screen.getByRole('button', { name: /importing/i })).toBeInTheDocument());
    resolveSave();
  });
});

// ── Footer & preview ─────────────────────────────────────────────────────────

describe('CsvImportModal — footer and preview', () => {
  it('calls onClose from the header close button', async () => {
    const onClose = vi.fn();
    sheetRows.current = [{ Name: 'Savings', Amount: '1000' }];
    const file = new File([''], 'test.csv', { type: 'text/csv' });
    render(<CsvImportModal file={file} onClose={onClose} />);
    await waitFor(() => screen.getByLabelText('Close'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose from the Cancel button', async () => {
    const onClose = vi.fn();
    sheetRows.current = [{ Name: 'Savings', Amount: '1000' }];
    const file = new File([''], 'test.csv', { type: 'text/csv' });
    render(<CsvImportModal file={file} onClose={onClose} />);
    await waitFor(() => screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a row count once rows are parsed', async () => {
    renderModal([{ Name: 'Savings', Amount: '1000' }, { Name: 'FD', Amount: '2000' }]);
    await waitFor(() => screen.getByText('2 rows detected'));
  });

  it('labels the modal "Import Excel" for an .xlsx file', async () => {
    renderModal([{ Name: 'Savings', Amount: '1000' }], 'export.xlsx');
    await waitFor(() => expect(screen.getByText('Import Excel')).toBeInTheDocument());
  });
});
