import { describe, it, expect } from 'vitest';
import { csvSafeCell, exportSnapshotToCSV, parseBackupJSON } from '../importExport';
import type { Snapshot } from '../../types';

describe('csvSafeCell — formula injection guard', () => {
  it('prefixes values starting with = with a quote', () => {
    expect(csvSafeCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
  });

  it('guards +, -, @ and control-char leads', () => {
    expect(csvSafeCell('+1')).toBe("'+1");
    expect(csvSafeCell('-1+2')).toBe("'-1+2");
    expect(csvSafeCell('@cmd')).toBe("'@cmd");
    expect(csvSafeCell('\tdanger')).toBe("'\tdanger");
  });

  it('leaves ordinary text untouched', () => {
    expect(csvSafeCell('HDFC Savings')).toBe('HDFC Savings');
    expect(csvSafeCell('Apartment (Pune)')).toBe('Apartment (Pune)');
  });

  it('still escapes embedded double-quotes', () => {
    expect(csvSafeCell('a "quote"')).toBe('a ""quote""');
    expect(csvSafeCell('="evil"')).toBe('\'=""evil""');
  });
});

describe('exportSnapshotToCSV', () => {
  function snap(itemName: string, catName = 'Cash'): Snapshot {
    return {
      id: 's1', month: '2026-01',
      createdAt: '', updatedAt: '', exchangeRates: {},
      categories: [{
        id: 'c1', name: catName, type: 'asset', icon: '💰', isLiquid: true, isInvestable: true,
        items: [{ id: 'i1', name: itemName, amount: 1000, currency: 'INR' }],
      }],
    };
  }

  it('neutralises a formula-injection item name', () => {
    const csv = exportSnapshotToCSV(snap('=HYPERLINK("http://evil")'));
    // The dangerous cell is quoted-prefixed and not left as a live formula.
    expect(csv).toContain('"\'=HYPERLINK');
    expect(csv).not.toContain('"=HYPERLINK');
  });

  it('neutralises a formula-injection category name', () => {
    const csv = exportSnapshotToCSV(snap('Salary', '=cmd|calc'));
    expect(csv).toContain('"\'=cmd|calc"');
  });

  it('keeps the header row and ordinary rows intact', () => {
    const csv = exportSnapshotToCSV(snap('Salary', 'Cash'));
    expect(csv.split('\n')[0]).toBe('Category,Type,Item Name,Currency,Amount,Excluded,GoalExcluded');
    expect(csv).toContain('"Cash","asset","Salary",INR,1000,No,No');
  });
});

describe('parseBackupJSON', () => {
  const valid = {
    version: 1,
    exportDate: new Date().toISOString(),
    snapshots: [{ id: 's1', month: '2026-01', categories: [], exchangeRates: {} }],
    goals: [],
    preferences: { baseCurrency: 'INR', enabledCurrencies: ['INR'] },
  };

  it('parses a valid backup', () => {
    const result = parseBackupJSON(JSON.stringify(valid));
    expect(result.snapshots).toHaveLength(1);
  });

  it('rejects an unsupported version', () => {
    expect(() => parseBackupJSON(JSON.stringify({ ...valid, version: 2 }))).toThrow(/Unsupported backup version/);
  });

  it('rejects a malformed month', () => {
    const bad = { ...valid, snapshots: [{ id: 's1', month: '2026/01', categories: [], exchangeRates: {} }] };
    expect(() => parseBackupJSON(JSON.stringify(bad))).toThrow(/invalid month format/);
  });

  it('rejects a missing snapshots array', () => {
    const { snapshots, ...rest } = valid;
    void snapshots;
    expect(() => parseBackupJSON(JSON.stringify(rest))).toThrow(/Missing or invalid snapshots/);
  });

  it('rejects non-JSON input', () => {
    expect(() => parseBackupJSON('not json')).toThrow(/Failed to parse backup/);
  });

  it('rejects missing baseCurrency in preferences', () => {
    const bad = { ...valid, preferences: { enabledCurrencies: ['INR'] } };
    expect(() => parseBackupJSON(JSON.stringify(bad))).toThrow(/baseCurrency/);
  });
});
