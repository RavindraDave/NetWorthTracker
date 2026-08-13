import { describe, it, expect } from 'vitest';
import { csvSafeCell, exportSnapshotToCSV, parseBackupJSON, buildExchangeRateRows, buildItemRow } from '../importExport';
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
    expect(csv.split('\n')[0])
      .toBe('Category,Sub-Category,Type,Item Name,Currency,Amount,Excluded,GoalExcluded');
    // Ungrouped items leave the sub-category cell empty rather than inventing a name.
    expect(csv).toContain('"Cash","","asset","Salary",INR,1000,No,No');
  });

  it('writes the sub-category name for a grouped item', () => {
    const s = snap('Parag Parikh', 'Investments');
    s.categories[0].subCategories = [{ id: 'sub-mf', name: 'Mutual Funds' }];
    s.categories[0].items[0].subCategoryId = 'sub-mf';

    const csv = exportSnapshotToCSV(s);
    expect(csv).toContain('"Investments","Mutual Funds","asset","Parag Parikh",INR,1000,No,No');
  });

  it('neutralises a formula-injection sub-category name', () => {
    const s = snap('Salary', 'Cash');
    s.categories[0].subCategories = [{ id: 'sub-x', name: '=cmd|calc' }];
    s.categories[0].items[0].subCategoryId = 'sub-x';

    const csv = exportSnapshotToCSV(s);
    expect(csv).toContain('"\'=cmd|calc"');
    expect(csv).not.toContain('"=cmd|calc"');
  });

  it('leaves the sub-category blank when the reference is orphaned', () => {
    const s = snap('Salary', 'Cash');
    s.categories[0].items[0].subCategoryId = 'sub-deleted';

    const csv = exportSnapshotToCSV(s);
    expect(csv).toContain('"Cash","","asset","Salary"');
  });
});

describe('buildItemRow', () => {
  function snapWithGroup(): Snapshot {
    return {
      id: 's1', month: '2026-01',
      createdAt: '', updatedAt: '', exchangeRates: {},
      categories: [{
        id: 'c1', name: 'Investments', type: 'asset', icon: '📈',
        isLiquid: true, isInvestable: true,
        subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
        items: [
          { id: 'i1', name: 'Fund A', amount: 1000, currency: 'INR', subCategoryId: 'sub-mf' },
          { id: 'i2', name: 'Loose', amount: 500, currency: 'INR' },
        ],
      }],
    };
  }

  /**
   * `json_to_sheet` derives the header row from key insertion order, so a key that
   * is only present on some rows shifts those rows' columns.
   */
  it('always emits the Sub-Category key, blank when ungrouped', () => {
    const snap = snapWithGroup();
    const cat = snap.categories[0];
    const asOf = new Date('2026-01-31');

    const grouped = buildItemRow(cat, cat.items[0], snap, 'INR', asOf);
    const ungrouped = buildItemRow(cat, cat.items[1], snap, 'INR', asOf);

    expect(Object.keys(grouped)).toEqual(Object.keys(ungrouped));
    expect(grouped['Sub-Category']).toBe('Mutual Funds');
    expect(ungrouped['Sub-Category']).toBe('');
  });

  it('places Sub-Category directly after Category', () => {
    const snap = snapWithGroup();
    const row = buildItemRow(snap.categories[0], snap.categories[0].items[0], snap, 'INR', new Date('2026-01-31'));
    expect(Object.keys(row).slice(0, 3)).toEqual(['Category', 'Sub-Category', 'Type']);
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

// ---------------------------------------------------------------------------
// buildExchangeRateRows — display rate computation (anchor-relative format)
// ---------------------------------------------------------------------------

describe('buildExchangeRateRows', () => {
  function makeSnap(exchangeRates: Record<string, number>, currencies: string[]): Snapshot {
    return {
      id: 's1', month: '2026-01',
      createdAt: '', updatedAt: '',
      exchangeRates,
      ratesAnchor: 'USD',
      categories: [{
        id: 'c1', name: 'Cash', type: 'asset', icon: '💰', isLiquid: true, isInvestable: true,
        items: currencies.map((c, i) => ({ id: `i${i}`, name: `Item ${i}`, amount: 1000, currency: c })),
      }],
    };
  }

  it('returns empty array when all items are in base currency', () => {
    const snap = makeSnap({ INR: 83 }, ['INR']);
    expect(buildExchangeRateRows(snap, 'INR')).toHaveLength(0);
  });

  it('computes correct display rate for SGD→INR', () => {
    // anchor: { INR: 83, SGD: 1.34 }
    // display: 1 SGD = 83/1.34 ≈ 61.94 INR
    const snap = makeSnap({ INR: 83, SGD: 1.34 }, ['SGD']);
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows).toHaveLength(1);
    expect(rows[0]['Currency']).toBe('SGD');
    const rate = rows[0]['Rate (1 SGD → INR)'] as number;
    expect(rate).toBeCloseTo(83 / 1.34, 3);
  });

  it('computes correct display rate for USD→INR', () => {
    // USD is the anchor (anchorRate=1), display: 1 USD = 83 INR
    const snap = makeSnap({ INR: 83 }, ['USD']);
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows).toHaveLength(1);
    const rate = rows[0]['Rate (1 USD → INR)'] as number;
    expect(rate).toBeCloseTo(83, 4);
  });

  it('computes correct display rate when base is USD', () => {
    // Base=USD, INR item: display 1 INR = 1/83 USD ≈ 0.01205
    const snap = makeSnap({ INR: 83 }, ['INR']);
    const rows = buildExchangeRateRows(snap, 'USD');
    expect(rows).toHaveLength(1);
    const rate = rows[0]['Rate (1 INR → USD)'] as number;
    expect(rate).toBeCloseTo(1 / 83, 5);
  });

  it('returns undefined rate when exchange rate is missing', () => {
    // SGD has no anchor rate set
    const snap = makeSnap({ INR: 83 }, ['SGD']);
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows[0]['Rate (1 SGD → INR)']).toBeUndefined();
  });

  it('returns undefined rate when base anchor rate is missing', () => {
    // rates has SGD but not INR (base) — baseRate = 0
    const snap = makeSnap({ SGD: 1.34 }, ['SGD']);
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows[0]['Rate (1 SGD → INR)']).toBeUndefined();
  });

  it('excludes items with excludeFromNetWorth=true', () => {
    const snap: Snapshot = {
      id: 's1', month: '2026-01', createdAt: '', updatedAt: '',
      exchangeRates: { INR: 83, SGD: 1.34 },
      categories: [{
        id: 'c1', name: 'Cash', type: 'asset', icon: '💰', isLiquid: true, isInvestable: true,
        items: [
          { id: 'i1', name: 'Included', amount: 1000, currency: 'SGD' },
          { id: 'i2', name: 'Excluded', amount: 500, currency: 'EUR', excludeFromNetWorth: true },
        ],
      }],
    };
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows.map(r => r['Currency'])).toEqual(['SGD']); // EUR excluded
  });

  it('deduplicates currencies used in multiple items', () => {
    const snap: Snapshot = {
      id: 's1', month: '2026-01', createdAt: '', updatedAt: '',
      exchangeRates: { INR: 83, SGD: 1.34 },
      categories: [{
        id: 'c1', name: 'Cash', type: 'asset', icon: '💰', isLiquid: true, isInvestable: true,
        items: [
          { id: 'i1', name: 'A', amount: 1000, currency: 'SGD' },
          { id: 'i2', name: 'B', amount: 500, currency: 'SGD' },
        ],
      }],
    };
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows).toHaveLength(1); // SGD appears once
  });
});
