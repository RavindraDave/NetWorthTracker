import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCsvParser, isExcelFile, normalize, autoDetect, CSV_FIELDS } from '../useCsvParser';
import type { UserPreferences } from '../../types';

const mocks = vi.hoisted(() => ({
  updatePreferences: vi.fn().mockResolvedValue(undefined),
  success: vi.fn(),
  preferences: undefined as UserPreferences | undefined,
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ preferences: mocks.preferences, updatePreferences: mocks.updatePreferences }),
}));

vi.mock('../../components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success }),
}));

// Controlled per-test: XLSX.read/sheet_to_json output and whether read() throws.
const xlsx = vi.hoisted(() => ({
  readImpl: vi.fn((..._args: unknown[]) => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } })),
  sheetToJson: vi.fn((..._args: unknown[]) => [] as Record<string, string>[]),
}));
vi.mock('xlsx', () => ({
  read: (...args: unknown[]) => xlsx.readImpl(...args),
  utils: { sheet_to_json: (...args: unknown[]) => xlsx.sheetToJson(...args) },
}));

class MockFileReader {
  result: string | ArrayBuffer = '';
  onload: ((e: Partial<ProgressEvent<FileReader>>) => void) | null = null;
  onerror: (() => void) | null = null;
  private failMode: 'none' | 'error' = 'none';
  constructor(failMode: 'none' | 'error' = 'none') { this.failMode = failMode; }
  readAsText(_: Blob) { this.fire(); }
  readAsArrayBuffer(_: Blob) { this.fire(); }
  private fire() {
    if (this.failMode === 'error') { this.onerror?.(); return; }
    this.onload?.({ target: this as unknown as FileReader } as Partial<ProgressEvent<FileReader>>);
  }
}

let readerFailMode: 'none' | 'error' = 'none';
// @ts-expect-error - override global FileReader with a synchronous, controllable stub
global.FileReader = class extends MockFileReader {
  constructor() { super(readerFailMode); }
};

function makeFile(name: string, size = 100): File {
  const file = new File(['x'.repeat(size)], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.preferences = undefined;
  readerFailMode = 'none';
  xlsx.readImpl.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
  xlsx.sheetToJson.mockReturnValue([]);
});

describe('isExcelFile', () => {
  it('is true for .xlsx and .xls extensions', () => {
    expect(isExcelFile(makeFile('data.xlsx'))).toBe(true);
    expect(isExcelFile(makeFile('data.xls'))).toBe(true);
  });

  it('is true for an Excel mime type even with a mismatched extension', () => {
    const file = new File([''], 'data.csv', { type: 'application/vnd.ms-excel' });
    expect(isExcelFile(file)).toBe(true);
  });

  it('is false for a plain .csv file', () => {
    expect(isExcelFile(makeFile('data.csv'))).toBe(false);
  });
});

describe('normalize', () => {
  it('lowercases and strips spaces, underscores, parens, hyphens and dots', () => {
    expect(normalize('Sub-Category')).toBe('subcategory');
    expect(normalize('Item Name')).toBe('itemname');
    expect(normalize('Amount (INR)')).toBe('amountinr');
  });
});

describe('autoDetect', () => {
  it('maps only headers that match a known alias', () => {
    const result = autoDetect(['Name', 'Balance', 'Unrelated']);
    expect(result['Item Name']).toBe('Name');
    expect(result['Amount']).toBe('Balance');
    expect(result['Currency']).toBeUndefined();
  });
});

describe('useCsvParser — CSV parsing', () => {
  it('rejects a file over 5MB without touching the file reader', () => {
    const file = makeFile('big.csv', 6 * 1024 * 1024);
    const { result } = renderHook(() => useCsvParser(file));
    expect(result.current.parseError).toMatch(/too large/i);
  });

  it('parses headers and rows from a CSV file', async () => {
    xlsx.sheetToJson.mockReturnValue([{ Name: 'Savings', Amount: '1000' }]);
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.headers).toEqual(['Name', 'Amount']));
    expect(result.current.rows).toEqual([{ Name: 'Savings', Amount: '1000' }]);
    expect(result.current.parseError).toBeNull();
  });

  it('parses an Excel file via readAsArrayBuffer', async () => {
    xlsx.sheetToJson.mockReturnValue([{ Name: 'Savings', Amount: '1000' }]);
    const file = makeFile('data.xlsx');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.headers).toEqual(['Name', 'Amount']));
  });

  it('reports an error when the file has no data rows', async () => {
    xlsx.sheetToJson.mockReturnValue([]);
    const file = makeFile('empty.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.parseError).toMatch(/no data rows/i));
  });

  it('drops __EMPTY and dangerous-key columns from the headers', async () => {
    xlsx.sheetToJson.mockReturnValue([{ Name: 'Savings', __EMPTY_1: 'x', __proto__: 'y' }]);
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.headers).toEqual(['Name']));
  });

  it('drops fully-blank trailing rows', async () => {
    xlsx.sheetToJson.mockReturnValue([
      { Name: 'Savings', Amount: '1000' },
      { Name: '', Amount: '' },
    ]);
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
  });

  it('reports a parse error when XLSX.read throws', async () => {
    xlsx.readImpl.mockImplementation(() => { throw new Error('bad file'); });
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.parseError).toMatch(/could not parse/i));
  });

  it('reports a read error when the FileReader itself fails', async () => {
    readerFailMode = 'error';
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.parseError).toMatch(/could not read file/i));
  });
});

describe('useCsvParser — mapping profiles', () => {
  it('exposes no profiles when none are saved', async () => {
    xlsx.sheetToJson.mockReturnValue([{ Name: 'Savings', Amount: '1000' }]);
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.headers.length).toBeGreaterThan(0));
    expect(result.current.profileNames).toEqual([]);
  });

  it('applyProfile returns null for an unknown profile name', async () => {
    xlsx.sheetToJson.mockReturnValue([{ Name: 'Savings', Amount: '1000' }]);
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.headers.length).toBeGreaterThan(0));
    expect(result.current.applyProfile('missing')).toBeNull();
  });

  it('applyProfile filters out columns the current file does not have', async () => {
    mocks.preferences = {
      baseCurrency: 'INR', enabledCurrencies: ['INR'],
      csvMappingProfiles: { mine: { 'Item Name': 'Name', 'Amount': 'GoneColumn' } },
    } as unknown as UserPreferences;
    xlsx.sheetToJson.mockReturnValue([{ Name: 'Savings', Amount: '1000' }]);
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.headers.length).toBeGreaterThan(0));
    const mapping = result.current.applyProfile('mine');
    expect(mapping).toEqual({ 'Item Name': 'Name' });
    expect(result.current.profileNames).toEqual(['mine']);
  });

  it('saveProfile is a no-op for a blank name', async () => {
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await result.current.saveProfile('   ', {});
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
  });

  it('saveProfile persists the mapping and shows a success toast', async () => {
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await result.current.saveProfile('My mapping', { 'Item Name': 'Name' });
    expect(mocks.updatePreferences).toHaveBeenCalledWith({
      csvMappingProfiles: { 'My mapping': { 'Item Name': 'Name' } },
    });
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('My mapping'));
  });

  it('deleteProfile removes the named profile and shows a success toast', async () => {
    mocks.preferences = {
      baseCurrency: 'INR', enabledCurrencies: ['INR'],
      csvMappingProfiles: { mine: {}, other: {} },
    } as unknown as UserPreferences;
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await result.current.deleteProfile('mine');
    expect(mocks.updatePreferences).toHaveBeenCalledWith({ csvMappingProfiles: { other: {} } });
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('mine'));
  });
});

describe('useCsvParser — autoDetectMapping', () => {
  it('defaults to detecting from the parsed headers', async () => {
    xlsx.sheetToJson.mockReturnValue([{ Name: 'Savings', Balance: '1000' }]);
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    await waitFor(() => expect(result.current.headers.length).toBeGreaterThan(0));
    const mapping = result.current.autoDetectMapping();
    expect(mapping['Item Name']).toBe('Name');
    expect(mapping['Amount']).toBe('Balance');
  });

  it('can be called with an explicit header list', () => {
    const file = makeFile('data.csv');
    const { result } = renderHook(() => useCsvParser(file));
    const mapping = result.current.autoDetectMapping(['Ccy']);
    expect(mapping['Currency']).toBe('Ccy');
  });
});

it('CSV_FIELDS lists every importable field', () => {
  expect(CSV_FIELDS).toContain('Item Name');
  expect(CSV_FIELDS).toContain('Sub-Category');
});
