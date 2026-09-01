import { describe, it, expect } from 'vitest';
import { applyImportRows } from '../importRowMerge';
import { Category, LineItem, Snapshot } from '../../types';

const OPTS = { enabledCurrencies: ['INR', 'USD', 'EUR'], baseCurrency: 'INR' };

function item(overrides: Partial<LineItem> & { id: string; name: string }): LineItem {
  return { amount: 0, currency: 'INR', ...overrides };
}

function cat(overrides: Partial<Category> & { id: string; name: string; type: 'asset' | 'liability' }): Category {
  return { icon: '', isLiquid: true, isInvestable: true, items: [], ...overrides };
}

function snap(categories: Category[]): Snapshot {
  return { id: 's1', month: '2026-09', createdAt: '', updatedAt: '', exchangeRates: {}, categories };
}

const MAPPING = { 'Item Name': 'Name', 'Category': 'Cat', 'Amount': 'Amt', 'Currency': 'Ccy' };

describe('applyImportRows', () => {
  it('inserts every row into a fresh (empty-category) snapshot — the "add as new" case', () => {
    const base = snap([]);
    const rows = [
      { Name: 'Kotak NRE', Cat: 'Cash & Bank', Amt: '1000', Ccy: 'INR' },
      { Name: 'US Stocks', Cat: 'Investments', Amt: '2000', Ccy: 'USD' },
    ];
    const result = applyImportRows(base, rows, MAPPING, OPTS);

    expect(result.rowActions).toEqual(['inserted', 'inserted']);
    expect(result.summary).toMatchObject({ updatedCount: 0, insertedCount: 2 });
    expect(result.snapshot.categories.map(c => c.name).sort()).toEqual(['Cash & Bank', 'Investments']);
  });

  it('updates an existing item by case-insensitive name match — amount/currency only', () => {
    const existing = item({ id: 'i1', name: 'Kotak NRE', amount: 500, currency: 'INR', tagIds: ['t1'], subCategoryId: 'sub1', notes: 'primary' });
    const base = snap([cat({ id: 'c1', name: 'Cash & Bank', type: 'asset', items: [existing] })]);
    const rows = [{ Name: 'kotak nre', Cat: 'Cash & Bank', Amt: '1200', Ccy: 'USD' }];

    const result = applyImportRows(base, rows, MAPPING, OPTS);

    expect(result.rowActions).toEqual(['updated']);
    expect(result.summary).toMatchObject({ updatedCount: 1, insertedCount: 0 });
    const updated = result.snapshot.categories[0].items[0];
    expect(updated.id).toBe('i1'); // same identity
    expect(updated.amount).toBe(1200);
    expect(updated.currency).toBe('USD');
    // Untouched despite this row not mapping them:
    expect(updated.tagIds).toEqual(['t1']);
    expect(updated.subCategoryId).toBe('sub1');
    expect(updated.notes).toBe('primary');
  });

  it('inserts as new when the name does not match anything in that category', () => {
    const base = snap([cat({ id: 'c1', name: 'Cash & Bank', type: 'asset', items: [item({ id: 'i1', name: 'Kotak NRE' })] })]);
    const rows = [{ Name: 'Kotak NRE (Matured)', Cat: 'Cash & Bank', Amt: '999', Ccy: 'INR' }];

    const result = applyImportRows(base, rows, MAPPING, OPTS);
    expect(result.rowActions).toEqual(['inserted']);
    expect(result.snapshot.categories[0].items).toHaveLength(2);
  });

  it('never deletes — an existing item matched by no row is left untouched', () => {
    const untouched = item({ id: 'i1', name: 'Old Manual Entry', amount: 42 });
    const base = snap([cat({ id: 'c1', name: 'Cash & Bank', type: 'asset', items: [untouched] })]);
    const rows = [{ Name: 'Brand New Account', Cat: 'Cash & Bank', Amt: '1', Ccy: 'INR' }];

    const result = applyImportRows(base, rows, MAPPING, OPTS);
    const names = result.snapshot.categories[0].items.map(i => i.name);
    expect(names).toContain('Old Manual Entry');
    expect(result.snapshot.categories[0].items.find(i => i.id === 'i1')).toEqual(untouched);
  });

  it('creates a new category when no existing one matches by name', () => {
    const base = snap([cat({ id: 'c1', name: 'Cash & Bank', type: 'asset' })]);
    const rows = [{ Name: 'Gold Coins', Cat: 'Precious Metals', Amt: '5000', Ccy: 'INR' }];
    const result = applyImportRows(base, rows, MAPPING, OPTS);
    expect(result.snapshot.categories.map(c => c.name)).toContain('Precious Metals');
  });

  it('finds or creates a sub-category the same way the original import path did', () => {
    const base = snap([cat({ id: 'c1', name: 'Investments', type: 'asset' })]);
    const rows = [{ Name: 'HDFC Fund', Cat: 'Investments', Amt: '1000', Ccy: 'INR', Sub: 'Mutual Funds' }];
    const mapping = { ...MAPPING, 'Sub-Category': 'Sub' };
    const result = applyImportRows(base, rows, mapping, OPTS);

    const invCat = result.snapshot.categories.find(c => c.name === 'Investments')!;
    expect(invCat.subCategories?.map(s => s.name)).toEqual(['Mutual Funds']);
    expect(invCat.items[0].subCategoryId).toBe(invCat.subCategories![0].id);
  });

  it('counts missing names, bad amounts, and unknown currencies the same way the original loop did', () => {
    const base = snap([]);
    const rows = [
      { Name: '', Cat: 'Cash & Bank', Amt: 'abc', Ccy: 'ZZZ' },
    ];
    const result = applyImportRows(base, rows, MAPPING, OPTS);
    expect(result.summary.missingNameCount).toBe(1);
    expect(result.summary.badAmountCount).toBe(1);
    expect(result.summary.unknownCurrencyCount).toBe(1);
  });

  it('is pure — never mutates the input snapshot, even the update path', () => {
    const existing = item({ id: 'i1', name: 'Kotak NRE', amount: 500 });
    const originalCat = cat({ id: 'c1', name: 'Cash & Bank', type: 'asset', items: [existing] });
    const base = snap([originalCat]);
    applyImportRows(base, [{ Name: 'Kotak NRE', Cat: 'Cash & Bank', Amt: '9999', Ccy: 'INR' }], MAPPING, OPTS);

    expect(base.categories[0]).toBe(originalCat);
    expect(base.categories[0].items[0].amount).toBe(500); // untouched
  });

  it('rowActions has one entry per input row, in the same order', () => {
    const base = snap([cat({ id: 'c1', name: 'Cash & Bank', type: 'asset', items: [item({ id: 'i1', name: 'A' })] })]);
    const rows = [
      { Name: 'A', Cat: 'Cash & Bank', Amt: '1', Ccy: 'INR' },   // update
      { Name: 'B', Cat: 'Cash & Bank', Amt: '2', Ccy: 'INR' },   // insert
      { Name: 'A', Cat: 'Cash & Bank', Amt: '3', Ccy: 'INR' },   // update (again, after row 1's update)
    ];
    const result = applyImportRows(base, rows, MAPPING, OPTS);
    expect(result.rowActions).toEqual(['updated', 'inserted', 'updated']);
    // Third row's update wins (last one processed) — no duplicate item created.
    expect(result.snapshot.categories[0].items.filter(i => i.name === 'A')).toHaveLength(1);
    expect(result.snapshot.categories[0].items.find(i => i.name === 'A')!.amount).toBe(3);
  });
});
