import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  csvSafeCell, exportSnapshotToCSV, parseBackupJSON, buildExchangeRateRows, buildItemRow,
  exportToJSON, downloadFile, exportSnapshotToExcel, exportAllToExcel,
} from '../importExport';
import type { Category, Goal, LineItem, Snapshot, UserPreferences } from '../../types';

// ESM module namespaces aren't configurable, so `writeFile` (real disk I/O) can't
// be spied on directly — partially mock the module instead, keeping every other
// XLSX export (book_new, json_to_sheet, book_append_sheet, ...) real so the sheet
// content this code actually builds is what gets asserted on.
const mocks = vi.hoisted(() => ({ writeFile: vi.fn() }));
vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return { ...actual, writeFile: mocks.writeFile };
});
beforeEach(() => mocks.writeFile.mockClear());

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

  it('marks Excluded and GoalExcluded as Yes for an excluded item', () => {
    const s = snap('Hidden', 'Cash');
    s.categories[0].items[0].excludeFromNetWorth = true;
    s.categories[0].items[0].excludeFromGoals = true;

    const csv = exportSnapshotToCSV(s);
    expect(csv).toContain('"Cash","","asset","Hidden",INR,1000,Yes,Yes');
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

  it('marks a liability category as "Liability" rather than "Asset"', () => {
    const snap = snapWithGroup();
    const liabilityCat: Category = { ...snap.categories[0], type: 'liability' };
    const row = buildItemRow(liabilityCat, liabilityCat.items[0], snap, 'INR', new Date('2026-01-31'));
    expect(row['Type']).toBe('Liability');
  });

  it('marks an excluded item as "No" for both In Net Worth and In Goals', () => {
    const snap = snapWithGroup();
    const excluded: LineItem = { ...snap.categories[0].items[0], excludeFromNetWorth: true, excludeFromGoals: true };
    const row = buildItemRow(snap.categories[0], excluded, snap, 'INR', new Date('2026-01-31'));
    expect(row['In Net Worth']).toBe('No');
    expect(row['In Goals']).toBe('No');
  });

  it('marks In Goals as "No" when only excludeFromGoals is set (net worth still counts it)', () => {
    const snap = snapWithGroup();
    const goalsOnly: LineItem = { ...snap.categories[0].items[0], excludeFromGoals: true };
    const row = buildItemRow(snap.categories[0], goalsOnly, snap, 'INR', new Date('2026-01-31'));
    expect(row['In Net Worth']).toBe('Yes');
    expect(row['In Goals']).toBe('No');
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

  it('rejects a top-level value that is not an object', () => {
    expect(() => parseBackupJSON(JSON.stringify(null))).toThrow(/Not a valid JSON object/);
    expect(() => parseBackupJSON(JSON.stringify('a string'))).toThrow(/Not a valid JSON object/);
  });

  it('rejects a missing goals array', () => {
    const { goals, ...rest } = valid;
    void goals;
    expect(() => parseBackupJSON(JSON.stringify(rest))).toThrow(/Missing or invalid goals/);
  });

  it('rejects a missing preferences object', () => {
    const { preferences, ...rest } = valid;
    void preferences;
    expect(() => parseBackupJSON(JSON.stringify(rest))).toThrow(/Missing preferences object/);
  });

  it('rejects a snapshot with a missing or blank id', () => {
    const bad = { ...valid, snapshots: [{ id: '', month: '2026-01', categories: [], exchangeRates: {} }] };
    expect(() => parseBackupJSON(JSON.stringify(bad))).toThrow(/missing or invalid id/);
  });

  it('rejects a snapshot with a missing categories array', () => {
    const bad = { ...valid, snapshots: [{ id: 's1', month: '2026-01', exchangeRates: {} }] };
    expect(() => parseBackupJSON(JSON.stringify(bad))).toThrow(/missing categories array/);
  });

  it('rejects a snapshot with a missing exchangeRates object', () => {
    const bad = { ...valid, snapshots: [{ id: 's1', month: '2026-01', categories: [] }] };
    expect(() => parseBackupJSON(JSON.stringify(bad))).toThrow(/missing exchangeRates object/);
  });

  it('rejects a missing enabledCurrencies array in preferences', () => {
    const bad = { ...valid, preferences: { baseCurrency: 'INR' } };
    expect(() => parseBackupJSON(JSON.stringify(bad))).toThrow(/enabledCurrencies/);
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

  it('includes a "Rates As Of" date when ratesLastUpdated is set', () => {
    const snap = { ...makeSnap({ INR: 83 }, ['USD']), ratesLastUpdated: '2026-06-10T00:00:00.000Z' };
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows[0]['Rates As Of']).toBe('2026-06-10');
  });

  it('leaves "Rates As Of" blank when ratesLastUpdated is absent', () => {
    const snap = makeSnap({ INR: 83 }, ['USD']);
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows[0]['Rates As Of']).toBe('');
  });

  it('treats a missing exchangeRates object as no rates set', () => {
    const snap = makeSnap({ INR: 83 }, ['USD']);
    // @ts-expect-error - simulating a snapshot with no exchangeRates at all
    delete snap.exchangeRates;
    const rows = buildExchangeRateRows(snap, 'INR');
    expect(rows[0]['Rate (1 USD → INR)']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// exportToJSON
// ---------------------------------------------------------------------------

describe('exportToJSON', () => {
  it('serialises snapshots, goals and preferences into a versioned backup', () => {
    const snapshots: Snapshot[] = [{
      id: 's1', month: '2026-01', createdAt: '', updatedAt: '', exchangeRates: {}, categories: [],
    }];
    const goals: Goal[] = [{ id: 'g1', type: 'fire', name: 'FIRE', createdAt: '', targetAmount: 1 }];
    const preferences: UserPreferences = { baseCurrency: 'INR', enabledCurrencies: ['INR'], theme: 'dark', profileName: 'U' };

    const json = exportToJSON(snapshots, goals, preferences);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.snapshots).toEqual(snapshots);
    expect(parsed.goals).toEqual(goals);
    expect(parsed.preferences).toEqual(preferences);
    expect(typeof parsed.exportDate).toBe('string');
  });

  it('round-trips through parseBackupJSON', () => {
    const snapshots: Snapshot[] = [{
      id: 's1', month: '2026-01', createdAt: '', updatedAt: '', exchangeRates: {}, categories: [],
    }];
    const preferences: UserPreferences = { baseCurrency: 'INR', enabledCurrencies: ['INR'], theme: 'dark', profileName: 'U' };
    const json = exportToJSON(snapshots, [], preferences);
    expect(parseBackupJSON(json).snapshots).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// downloadFile
// ---------------------------------------------------------------------------

describe('downloadFile', () => {
  it('creates an anchor, clicks it, and revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    // jsdom doesn't implement these — stub them for the duration of the test.
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    downloadFile('hello', 'test.csv', 'text/csv');

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('sets the anchor\'s filename and href from the arguments', () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url-2');
    URL.revokeObjectURL = vi.fn();
    let captured: HTMLAnchorElement | null = null;
    // click() is called as a.click(), so `this` inside the spy is the real anchor —
    // simpler than intercepting appendChild, and doesn't need to fake DOM insertion.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      captured = this;
    });

    downloadFile('data', 'report.xlsx', 'application/octet-stream');

    expect(captured!.download).toBe('report.xlsx');
    expect(captured!.href).toContain('blob:mock-url-2');
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// exportSnapshotToExcel / exportAllToExcel — real XLSX sheet-building logic;
// only XLSX.writeFile (actual disk I/O) is stubbed.
// ---------------------------------------------------------------------------

function xlsxCategory(o: Partial<Category> & { id: string }): Category {
  return { name: o.id, type: 'asset', icon: '💰', isLiquid: true, isInvestable: true, items: [], ...o };
}

function xlsxItem(o: Partial<LineItem> & { id: string }): LineItem {
  return { name: `Item ${o.id}`, amount: 1000, currency: 'INR', ...o };
}

function xlsxSnap(o: Partial<Snapshot> & { id: string; month: string }): Snapshot {
  return { createdAt: '', updatedAt: '', exchangeRates: {}, categories: [], ...o };
}

/** Read back a sheet already appended to the workbook as an array of row objects. */
function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  return ws ? XLSX.utils.sheet_to_json(ws) : [];
}

/**
 * The Returns sheet carries a one-line caption in row 1 before its real header row
 * (sheet_add_json is written at origin 'A3') — sheet_to_json's default header-row
 * guess would misread the caption as the header, so skip to row index 2.
 */
function returnsSheetRows(wb: XLSX.WorkBook): Record<string, unknown>[] {
  const ws = wb.Sheets['Returns'];
  return ws ? XLSX.utils.sheet_to_json(ws, { range: 2 }) : [];
}

describe('exportSnapshotToExcel', () => {
  it('writes Items, Summary and Exchange Rates sheets and calls writeFile with the month-named file', () => {
        let builtWorkbook: XLSX.WorkBook | null = null;
    const appendSpy = vi.spyOn(XLSX.utils, 'book_append_sheet');

    const snap = xlsxSnap({
      id: 's1', month: '2026-06',
      // Anchor-relative: USD is the implicit anchor (=1), so converting a USD item
      // into an INR-base snapshot needs the INR rate, not a USD one.
      exchangeRates: { INR: 83 },
      categories: [
        xlsxCategory({
          id: 'inv', name: 'Investments',
          subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
          items: [
            xlsxItem({ id: 'a', name: 'Fund A', amount: 1000, subCategoryId: 'sub-mf' }),
            xlsxItem({ id: 'b', name: 'US Stock', amount: 100, currency: 'USD' }),
          ],
        }),
      ],
    });

    exportSnapshotToExcel(snap, 'INR');

    expect(mocks.writeFile).toHaveBeenCalledWith(expect.anything(), 'snapshot-2026-06.xlsx');
    builtWorkbook = appendSpy.mock.calls[0][0] as XLSX.WorkBook;
    expect(builtWorkbook.SheetNames).toEqual(['Items', 'Summary', 'Exchange Rates']);

    const items = sheetRows(builtWorkbook, 'Items');
    expect(items).toHaveLength(2);
    expect(items[0]['Sub-Category']).toBe('Mutual Funds');

    const summary = sheetRows(builtWorkbook, 'Summary');
    // Category row + its one non-empty sub-group row + blank separator + 3 grand totals.
    expect(summary.some(r => r['Category'] === 'Investments')).toBe(true);
    expect(summary.some(r => String(r['Category']).includes('Mutual Funds'))).toBe(true);
    expect(summary.some(r => r['Category'] === 'Net Worth')).toBe(true);
    appendSpy.mockRestore();
  });

  it('omits the Exchange Rates sheet when everything is in the base currency', () => {
        const appendSpy = vi.spyOn(XLSX.utils, 'book_append_sheet');

    exportSnapshotToExcel(
      xlsxSnap({ id: 's1', month: '2026-06', categories: [xlsxCategory({ id: 'cash', items: [xlsxItem({ id: 'a' })] })] }),
      'INR',
    );

    const wb = appendSpy.mock.calls[0][0] as XLSX.WorkBook;
    expect(wb.SheetNames).toEqual(['Items', 'Summary']);
    appendSpy.mockRestore();
  });

  it('marks a liability category as "Liability" in the Summary sheet', () => {
        const appendSpy = vi.spyOn(XLSX.utils, 'book_append_sheet');

    exportSnapshotToExcel(
      xlsxSnap({
        id: 's1', month: '2026-06',
        categories: [xlsxCategory({ id: 'loan', name: 'Home Loan', type: 'liability', items: [xlsxItem({ id: 'a' })] })],
      }),
      'INR',
    );

    const wb = appendSpy.mock.calls[0][0] as XLSX.WorkBook;
    const summary = sheetRows(wb, 'Summary');
    const row = summary.find(r => r['Category'] === 'Home Loan');
    expect(row?.['Type']).toBe('Liability');
    appendSpy.mockRestore();
  });
});

describe('exportAllToExcel', () => {
  it('builds History, Exchange Rates, Returns and per-month detail sheets, sorted ascending', () => {
        const appendSpy = vi.spyOn(XLSX.utils, 'book_append_sheet');

    const snaps = [
      // Deliberately out of order — the function must sort ascending itself.
      // The cost-basis item sits on the LATEST month: buildAccountReturns is
      // built from `sorted[sorted.length - 1]`, so putting it on the older
      // snapshot would make the Returns sheet empty for the wrong reason.
      xlsxSnap({
        id: 's2', month: '2026-07', monthlyIncome: 1000, monthlyExpenses: 400,
        exchangeRates: { INR: 83 },
        categories: [xlsxCategory({
          id: 'inv',
          items: [xlsxItem({
            id: 'b', name: 'Fund', amount: 20000, currency: 'INR',
            purchasePrice: 15000, purchaseDate: '2025-01-01',
          })],
        })],
      }),
      xlsxSnap({
        id: 's1', month: '2026-06',
        exchangeRates: { INR: 83 },
        // A foreign-currency item so the Exchange Rates sheet has something to show.
        categories: [xlsxCategory({ id: 'cash', items: [
          xlsxItem({ id: 'a', amount: 500, currency: 'INR' }),
          xlsxItem({ id: 'c', amount: 10, currency: 'USD' }),
        ] })],
      }),
    ];

    exportAllToExcel(snaps, 'INR');

    expect(mocks.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^wealthpulse-history-\d{4}-\d{2}-\d{2}\.xlsx$/));
    const wb = appendSpy.mock.calls[0][0] as XLSX.WorkBook;

    const history = sheetRows(wb, 'Net Worth History');
    expect(history.map(r => r['Month'])).toEqual(['2026-06', '2026-07']); // ascending
    expect(history[1]['Savings Rate (%)']).toBe(60);

    expect(wb.SheetNames).toContain('Exchange Rates');
    expect(wb.SheetNames).toContain('Returns');
    expect(wb.SheetNames).toContain('2026-06');
    expect(wb.SheetNames).toContain('2026-07');
    appendSpy.mockRestore();
  });

  it('leaves purchase/cost-basis columns blank for a stated-rate-only account', () => {
        const appendSpy = vi.spyOn(XLSX.utils, 'book_append_sheet');

    exportAllToExcel(
      [xlsxSnap({
        id: 's1', month: '2026-06',
        categories: [xlsxCategory({ id: 'fd', items: [xlsxItem({ id: 'a', statedReturnRate: 6.5 })] })],
      })],
      'INR',
    );

    const wb = appendSpy.mock.calls[0][0] as XLSX.WorkBook;
    const rows = returnsSheetRows(wb);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Purchase Date']).toBe('');
    expect(rows[0]['Purchase Price']).toBeUndefined();
    expect(rows[0]['Cost Basis (INR)']).toBeUndefined();
    expect(rows[0]['Unrealised Gain (INR)']).toBeUndefined();
    expect(rows[0]['Total Return %']).toBeUndefined();
    appendSpy.mockRestore();
  });

  it('skips the Returns sheet when nothing has a cost basis or stated rate', () => {
        const appendSpy = vi.spyOn(XLSX.utils, 'book_append_sheet');

    exportAllToExcel(
      [xlsxSnap({ id: 's1', month: '2026-06', categories: [xlsxCategory({ id: 'cash', items: [xlsxItem({ id: 'a' })] })] })],
      'INR',
    );

    const wb = appendSpy.mock.calls[0][0] as XLSX.WorkBook;
    expect(wb.SheetNames).not.toContain('Returns');
    appendSpy.mockRestore();
  });

  it('skips a detail sheet for a month with no items, and caps detail sheets at the 30 most recent', () => {
        const appendSpy = vi.spyOn(XLSX.utils, 'book_append_sheet');

    const empty = xlsxSnap({ id: 'empty', month: '2020-01', categories: [] });
    const many = Array.from({ length: 32 }, (_, i) => {
      const y = 2021 + Math.floor(i / 12);
      const m = String((i % 12) + 1).padStart(2, '0');
      return xlsxSnap({
        id: `s${i}`, month: `${y}-${m}`,
        categories: [xlsxCategory({ id: 'cash', items: [xlsxItem({ id: `i${i}` })] })],
      });
    });

    exportAllToExcel([empty, ...many], 'INR');

    const wb = appendSpy.mock.calls[0][0] as XLSX.WorkBook;
    expect(wb.SheetNames).not.toContain('2020-01'); // no items, skipped
    const monthSheets = wb.SheetNames.filter(n => /^\d{4}-\d{2}$/.test(n));
    expect(monthSheets).toHaveLength(30); // capped, keeps the most recent
    appendSpy.mockRestore();
  });

  it('handles an empty snapshot list without throwing', () => {
        expect(() => exportAllToExcel([], 'INR')).not.toThrow();
  });
});
