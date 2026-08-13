import { describe, it, expect } from 'vitest';
import { buildCategoryRows, CategoryRowsContext } from '../printReport';
import { calcNetWorth } from '../calculations';
import { Category, LineItem, Snapshot } from '../../types';

/**
 * Structural tests for the print report. `window.print()` fires immediately, so
 * reviewers see the OS dialog rather than this HTML — a colgroup misalignment
 * shipped from here once. These assert the invariants that keep columns aligned
 * across categories with different content widths.
 */

function item(o: Partial<LineItem> & { id: string }): LineItem {
  return { name: `Item ${o.id}`, amount: 1000, currency: 'INR', ...o };
}

function category(o: Partial<Category> = {}): Category {
  return {
    id: 'cat-inv', name: 'Investments', type: 'asset', icon: '📈',
    isLiquid: true, isInvestable: true, items: [], ...o,
  };
}

function ctxFor(cats: Category[]): { ctx: CategoryRowsContext; snapshot: Snapshot } {
  const snapshot: Snapshot = {
    id: 's1', month: '2026-06',
    createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
    exchangeRates: { INR: 83, EUR: 0.92222 },
    categories: cats,
  };
  const { categoryTotals } = calcNetWorth(snapshot, 'INR');
  return { ctx: { categoryTotals, snapshot, baseCurrency: 'INR', locale: 'en-IN' }, snapshot };
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('buildCategoryRows — layout invariants', () => {
  it('emits exactly one fixed-layout table with one colgroup per category', () => {
    const cats = [
      category({ id: 'c1', name: 'Investments', items: [item({ id: 'a' })] }),
      category({ id: 'c2', name: 'Cash', items: [item({ id: 'b' })] }),
    ];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(count(html, '<table')).toBe(2);
    expect(count(html, '<colgroup>')).toBe(2);
    expect(count(html, 'table-layout:fixed')).toBe(2);
    // The 50/10/20/20 split is what aligns columns across categories.
    expect(count(html, 'width:50%')).toBe(2);
    expect(count(html, 'width:10%')).toBe(2);
    expect(count(html, 'width:20%')).toBe(4);
  });

  it('never nests a table, even with groups', () => {
    const cats = [category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [item({ id: 'a', subCategoryId: 'sub-mf' }), item({ id: 'b' })],
    })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(count(html, '<table')).toBe(1);
    expect(count(html, '</table>')).toBe(1);
  });

  it('renders group headers as colspan rows inside the same table', () => {
    const cats = [category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [item({ id: 'a', subCategoryId: 'sub-mf' })],
    })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(html).toContain('colspan="3"');
    expect(html).toContain('Mutual Funds');
  });

  it('adds no group chrome when a category has no groups', () => {
    const cats = [category({ items: [item({ id: 'a' }), item({ id: 'b' })] })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(html).not.toContain('colspan');
    expect(html).not.toContain('Other');
  });

  it('labels ungrouped items "Other" only when named groups exist alongside', () => {
    const cats = [category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [item({ id: 'a', subCategoryId: 'sub-mf' }), item({ id: 'loose' })],
    })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(html).toContain('Other');
    expect(count(html, 'colspan="3"')).toBe(2); // Mutual Funds + Other
  });

  it('omits groups whose items are all excluded', () => {
    const cats = [category({
      subCategories: [
        { id: 'sub-mf', name: 'Mutual Funds' },
        { id: 'sub-empty', name: 'Bonds' },
      ],
      items: [item({ id: 'a', subCategoryId: 'sub-mf' })],
    })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(html).toContain('Mutual Funds');
    expect(html).not.toContain('Bonds');
  });

  it('escapes HTML in group names', () => {
    const cats = [category({
      subCategories: [{ id: 'sub-x', name: '<script>alert(1)</script>' }],
      items: [item({ id: 'a', subCategoryId: 'sub-x' })],
    })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('indents grouped item rows without touching the column widths', () => {
    const cats = [category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [item({ id: 'a', subCategoryId: 'sub-mf' })],
    })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(html).toContain('padding:5px 8px 5px 28px');
    expect(count(html, 'width:50%')).toBe(1); // colgroup untouched
  });

  it('excludes excluded items from the printed rows', () => {
    const cats = [category({
      items: [item({ id: 'shown' }), item({ id: 'hidden', excludeFromNetWorth: true })],
    })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(html).toContain('Item shown');
    expect(html).not.toContain('Item hidden');
  });
});

describe('buildCategoryRows — totals', () => {
  it('group subtotals sum to the category total in the header strip', () => {
    const cats = [category({
      subCategories: [
        { id: 'sub-mf', name: 'Mutual Funds' },
        { id: 'sub-stocks', name: 'Stocks' },
      ],
      items: [
        item({ id: 'a', amount: 100000, subCategoryId: 'sub-mf' }),
        item({ id: 'b', amount: 50000, subCategoryId: 'sub-stocks' }),
        item({ id: 'c', amount: 25000 }),
      ],
    })];
    const { ctx } = ctxFor(cats);
    const html = buildCategoryRows(cats, ctx);

    // The category header strip shows the full total…
    expect(html).toContain('1,75,000');
    // …and each group contributes its own printed subtotal.
    expect(html).toContain('1,00,000');
    expect(html).toContain('50,000');
    expect(html).toContain('25,000');
    expect(ctx.categoryTotals['cat-inv']).toBeCloseTo(175000, 6);
  });

  it('keeps an excluded item out of its group subtotal', () => {
    const cats = [category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [
        item({ id: 'a', amount: 100000, subCategoryId: 'sub-mf' }),
        item({ id: 'b', amount: 999999, subCategoryId: 'sub-mf', excludeFromNetWorth: true }),
      ],
    })];
    const html = buildCategoryRows(cats, ctxFor(cats).ctx);

    expect(html).toContain('1,00,000');
    expect(html).not.toContain('9,99,999');
  });
});
