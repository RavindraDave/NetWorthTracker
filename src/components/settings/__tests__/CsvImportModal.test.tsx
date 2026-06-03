import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CsvImportModal } from '../CsvImportModal';
import type { Snapshot, UserPreferences } from '../../../types';

// ── Top-level mocks ────────────────────────────────────────────────────────

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
    saveSnapshot: vi.fn(),
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
