import { describe, it, expect } from 'vitest';
import {
  normalizeSubName,
  groupItemsBySubCategory,
  subCategoryName,
  findSubCategoryIdByName,
  ensureSubCategory,
  renameSubCategory,
  deleteSubCategory,
  mergeSubCategories,
  moveSubCategory,
  pruneOrphanSubCategoryIds,
  hasSubCategories,
  buildSubCategoryAllocationData,
  MAX_ALLOCATION_SLICES,
} from '../subCategories';
import { calcCategoryTotal } from '../calculations';
import { Category, LineItem, Snapshot } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RATES = { INR: 83, EUR: 0.92222 };
const BASE = 'INR';

function item(overrides: Partial<LineItem> & { id: string }): LineItem {
  return { name: `Item ${overrides.id}`, amount: 100, currency: 'INR', ...overrides };
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-inv',
    name: 'Investments',
    type: 'asset',
    icon: '📈',
    isLiquid: true,
    isInvestable: true,
    items: [],
    ...overrides,
  };
}

/** A category with two defined groups, one mixed-in ungrouped item. */
function mixedCategory(): Category {
  return category({
    subCategories: [
      { id: 'sub-mf', name: 'Mutual Funds' },
      { id: 'sub-stocks', name: 'Stocks' },
    ],
    items: [
      item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf' }),
      item({ id: 'b', amount: 2000, subCategoryId: 'sub-mf' }),
      item({ id: 'c', amount: 500, subCategoryId: 'sub-stocks' }),
      item({ id: 'd', amount: 250 }), // ungrouped
    ],
  });
}

function snapshot(categories: Category[]): Snapshot {
  return {
    id: 's1',
    month: '2026-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exchangeRates: RATES,
    categories,
  };
}

// ---------------------------------------------------------------------------
// normalizeSubName
// ---------------------------------------------------------------------------

describe('normalizeSubName', () => {
  it('trims, collapses internal whitespace and lowercases', () => {
    expect(normalizeSubName('  mutual   FUNDS ')).toBe('mutual funds');
    expect(normalizeSubName('Mutual Funds')).toBe('mutual funds');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeSubName('   ')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// groupItemsBySubCategory — the conservation invariants
// ---------------------------------------------------------------------------

describe('groupItemsBySubCategory', () => {
  it('conserves item count and total against calcCategoryTotal', () => {
    const cat = mixedCategory();
    const groups = groupItemsBySubCategory(cat, BASE, RATES);

    const itemCount = groups.reduce((n, g) => n + g.items.length, 0);
    const total = groups.reduce((n, g) => n + g.total, 0);

    expect(itemCount).toBe(cat.items.length);
    expect(total).toBeCloseTo(calcCategoryTotal(cat, BASE, RATES), 6);
  });

  it('conserves the total under forGoals filtering too', () => {
    const cat = category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [
        item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf' }),
        item({ id: 'b', amount: 2000, subCategoryId: 'sub-mf', excludeFromGoals: true }),
        item({ id: 'c', amount: 500 }),
      ],
    });

    const groups = groupItemsBySubCategory(cat, BASE, RATES, { forGoals: true });
    const total = groups.reduce((n, g) => n + g.total, 0);

    expect(total).toBeCloseTo(calcCategoryTotal(cat, BASE, RATES, true), 6);
    expect(total).toBeCloseTo(1500, 6);
  });

  it('returns a single ungrouped bucket when no groups are defined', () => {
    const cat = category({ items: [item({ id: 'a' }), item({ id: 'b' })] });
    const groups = groupItemsBySubCategory(cat, BASE, RATES);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBeNull();
    expect(groups[0].items).toHaveLength(2);
  });

  it('orders defined groups by array position with ungrouped last', () => {
    const groups = groupItemsBySubCategory(mixedCategory(), BASE, RATES);
    expect(groups.map(g => g.id)).toEqual(['sub-mf', 'sub-stocks', null]);
  });

  it('follows subCategories array order after a reorder', () => {
    const cat = moveSubCategory(mixedCategory(), 'sub-stocks', -1);
    const groups = groupItemsBySubCategory(cat, BASE, RATES);
    expect(groups.map(g => g.id)).toEqual(['sub-stocks', 'sub-mf', null]);
  });

  it('routes an orphaned subCategoryId into the ungrouped bucket', () => {
    const cat = category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [
        item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf' }),
        item({ id: 'ghost', amount: 400, subCategoryId: 'sub-deleted' }),
      ],
    });

    const groups = groupItemsBySubCategory(cat, BASE, RATES);
    const ungrouped = groups.find(g => g.id === null);

    expect(ungrouped?.items.map(i => i.id)).toEqual(['ghost']);
    // Still conserved — an orphan is never silently dropped.
    expect(groups.reduce((n, g) => n + g.total, 0)).toBeCloseTo(
      calcCategoryTotal(cat, BASE, RATES), 6,
    );
  });

  it('keeps excluded items visible but out of the subtotal', () => {
    const cat = category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [
        item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf' }),
        item({ id: 'b', amount: 9999, subCategoryId: 'sub-mf', excludeFromNetWorth: true }),
      ],
    });

    const [mf] = groupItemsBySubCategory(cat, BASE, RATES);
    expect(mf.items).toHaveLength(2);
    expect(mf.total).toBeCloseTo(1000, 6);
  });

  it('converts foreign currency amounts into the base currency', () => {
    const cat = category({
      subCategories: [{ id: 'sub-fx', name: 'Overseas' }],
      items: [item({ id: 'a', amount: 100, currency: 'EUR', subCategoryId: 'sub-fx' })],
    });

    const [fx] = groupItemsBySubCategory(cat, BASE, RATES);
    expect(fx.total).toBeCloseTo(100 * (83 / 0.92222), 4);
  });

  it('omits empty groups by default and keeps them with includeEmpty', () => {
    const cat = category({
      subCategories: [
        { id: 'sub-mf', name: 'Mutual Funds' },
        { id: 'sub-empty', name: 'Bonds' },
      ],
      items: [item({ id: 'a', subCategoryId: 'sub-mf' })],
    });

    expect(groupItemsBySubCategory(cat, BASE, RATES).map(g => g.id)).toEqual(['sub-mf']);
    expect(groupItemsBySubCategory(cat, BASE, RATES, { includeEmpty: true }).map(g => g.id))
      .toEqual(['sub-mf', 'sub-empty', null]);
  });

  it('always offers an ungrouped bucket with includeEmpty, even when every item is filed', () => {
    const cat = category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [item({ id: 'a', subCategoryId: 'sub-mf' })],
    });

    const groups = groupItemsBySubCategory(cat, BASE, RATES, { includeEmpty: true });
    expect(groups[groups.length - 1]).toMatchObject({ id: null, items: [] });
  });

  it('returns nothing for an empty category without includeEmpty', () => {
    expect(groupItemsBySubCategory(category(), BASE, RATES)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

describe('subCategoryName / findSubCategoryIdByName / hasSubCategories', () => {
  it('resolves a name from an id, and undefined when ungrouped or orphaned', () => {
    const cat = mixedCategory();
    expect(subCategoryName(cat, 'sub-mf')).toBe('Mutual Funds');
    expect(subCategoryName(cat, undefined)).toBeUndefined();
    expect(subCategoryName(cat, 'sub-gone')).toBeUndefined();
  });

  it('finds an id by case-insensitive, whitespace-insensitive name', () => {
    const cat = mixedCategory();
    expect(findSubCategoryIdByName(cat, '  mutual   FUNDS ')).toBe('sub-mf');
    expect(findSubCategoryIdByName(cat, 'Bonds')).toBeUndefined();
    expect(findSubCategoryIdByName(cat, '   ')).toBeUndefined();
  });

  it('reports whether a category has any groups', () => {
    expect(hasSubCategories(mixedCategory())).toBe(true);
    expect(hasSubCategories(category())).toBe(false);
    expect(hasSubCategories(category({ subCategories: [] }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ensureSubCategory
// ---------------------------------------------------------------------------

describe('ensureSubCategory', () => {
  it('reuses an existing group on a case-insensitive match', () => {
    const cat = mixedCategory();
    const result = ensureSubCategory(cat, '  mutual   FUNDS ');

    expect(result.created).toBe(false);
    expect(result.id).toBe('sub-mf');
    expect(result.category).toBe(cat); // untouched reference
    expect(result.category.subCategories).toHaveLength(2);
  });

  it('creates a new group when there is no match, without mutating the input', () => {
    const cat = mixedCategory();
    const before = JSON.stringify(cat);
    const result = ensureSubCategory(cat, 'Bonds');

    expect(result.created).toBe(true);
    expect(result.category.subCategories).toHaveLength(3);
    expect(result.category.subCategories?.[2]).toMatchObject({ id: result.id, name: 'Bonds' });
    expect(JSON.stringify(cat)).toBe(before);
  });

  it('normalises the stored name but preserves the original casing', () => {
    const { category: next, id } = ensureSubCategory(category(), '  Fixed   Deposits  ');
    expect(next.subCategories?.find(s => s.id === id)?.name).toBe('Fixed Deposits');
  });

  it('creates the subCategories array on a category that had none', () => {
    const { category: next } = ensureSubCategory(category(), 'Mutual Funds');
    expect(next.subCategories).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// renameSubCategory
// ---------------------------------------------------------------------------

describe('renameSubCategory', () => {
  it('renames in place', () => {
    const { category: next, collidesWith } = renameSubCategory(mixedCategory(), 'sub-mf', 'MF Portfolio');
    expect(collidesWith).toBeUndefined();
    expect(subCategoryName(next, 'sub-mf')).toBe('MF Portfolio');
  });

  it('reports a collision instead of creating a duplicate', () => {
    const cat = mixedCategory();
    const { category: next, collidesWith } = renameSubCategory(cat, 'sub-stocks', 'mutual funds');

    expect(collidesWith).toBe('sub-mf');
    expect(next).toBe(cat); // unchanged — caller offers a merge
  });

  it('allows renaming a group to a different casing of its own name', () => {
    const { collidesWith, category: next } = renameSubCategory(mixedCategory(), 'sub-mf', 'MUTUAL FUNDS');
    expect(collidesWith).toBeUndefined();
    expect(subCategoryName(next, 'sub-mf')).toBe('MUTUAL FUNDS');
  });

  it('ignores an empty name', () => {
    const cat = mixedCategory();
    expect(renameSubCategory(cat, 'sub-mf', '   ').category).toBe(cat);
  });
});

// ---------------------------------------------------------------------------
// deleteSubCategory
// ---------------------------------------------------------------------------

describe('deleteSubCategory', () => {
  it('removes the definition and unfiles its items without deleting any', () => {
    const cat = mixedCategory();
    const next = deleteSubCategory(cat, 'sub-mf');

    expect(next.subCategories?.map(s => s.id)).toEqual(['sub-stocks']);
    expect(next.items).toHaveLength(cat.items.length);
    expect(next.items.filter(i => i.subCategoryId === 'sub-mf')).toHaveLength(0);
  });

  it('leaves the category total unchanged', () => {
    const cat = mixedCategory();
    expect(calcCategoryTotal(deleteSubCategory(cat, 'sub-mf'), BASE, RATES))
      .toBeCloseTo(calcCategoryTotal(cat, BASE, RATES), 6);
  });

  it('drops the key entirely rather than leaving an undefined', () => {
    const next = deleteSubCategory(mixedCategory(), 'sub-mf');
    const unfiled = next.items.find(i => i.id === 'a')!;
    expect('subCategoryId' in unfiled).toBe(false);
  });

  it('does not mutate the input', () => {
    const cat = mixedCategory();
    const before = JSON.stringify(cat);
    deleteSubCategory(cat, 'sub-mf');
    expect(JSON.stringify(cat)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// mergeSubCategories
// ---------------------------------------------------------------------------

describe('mergeSubCategories', () => {
  it('remaps items and drops the source definition', () => {
    const next = mergeSubCategories(mixedCategory(), 'sub-stocks', 'sub-mf');

    expect(next.subCategories?.map(s => s.id)).toEqual(['sub-mf']);
    expect(next.items.filter(i => i.subCategoryId === 'sub-mf')).toHaveLength(3);
    expect(next.items).toHaveLength(4);
  });

  it('is idempotent', () => {
    const once = mergeSubCategories(mixedCategory(), 'sub-stocks', 'sub-mf');
    const twice = mergeSubCategories(once, 'sub-stocks', 'sub-mf');
    expect(twice).toEqual(once);
  });

  it('is a no-op when source and target are the same, or the target is unknown', () => {
    const cat = mixedCategory();
    expect(mergeSubCategories(cat, 'sub-mf', 'sub-mf')).toBe(cat);
    expect(mergeSubCategories(cat, 'sub-mf', 'sub-nope')).toBe(cat);
  });

  it('preserves the category total', () => {
    const cat = mixedCategory();
    expect(calcCategoryTotal(mergeSubCategories(cat, 'sub-stocks', 'sub-mf'), BASE, RATES))
      .toBeCloseTo(calcCategoryTotal(cat, BASE, RATES), 6);
  });
});

// ---------------------------------------------------------------------------
// moveSubCategory
// ---------------------------------------------------------------------------

describe('moveSubCategory', () => {
  it('swaps adjacent positions', () => {
    expect(moveSubCategory(mixedCategory(), 'sub-stocks', -1).subCategories?.map(s => s.id))
      .toEqual(['sub-stocks', 'sub-mf']);
    expect(moveSubCategory(mixedCategory(), 'sub-mf', 1).subCategories?.map(s => s.id))
      .toEqual(['sub-stocks', 'sub-mf']);
  });

  it('clamps at both ends rather than wrapping', () => {
    const cat = mixedCategory();
    expect(moveSubCategory(cat, 'sub-mf', -1)).toBe(cat);
    expect(moveSubCategory(cat, 'sub-stocks', 1)).toBe(cat);
  });

  it('is a no-op for an unknown id', () => {
    const cat = mixedCategory();
    expect(moveSubCategory(cat, 'sub-nope', 1)).toBe(cat);
  });
});

// ---------------------------------------------------------------------------
// pruneOrphanSubCategoryIds
// ---------------------------------------------------------------------------

describe('pruneOrphanSubCategoryIds', () => {
  it('returns the identical reference when nothing is orphaned', () => {
    const snap = snapshot([mixedCategory()]);
    expect(pruneOrphanSubCategoryIds(snap)).toBe(snap);
  });

  it('returns the identical reference for categories with no groups at all', () => {
    const snap = snapshot([category({ items: [item({ id: 'a' })] })]);
    expect(pruneOrphanSubCategoryIds(snap)).toBe(snap);
  });

  it('strips references to definitions that no longer exist', () => {
    const snap = snapshot([
      category({
        subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
        items: [
          item({ id: 'a', subCategoryId: 'sub-mf' }),
          item({ id: 'ghost', subCategoryId: 'sub-deleted' }),
        ],
      }),
    ]);

    const next = pruneOrphanSubCategoryIds(snap);
    expect(next).not.toBe(snap);
    expect(next.categories[0].items.find(i => i.id === 'a')?.subCategoryId).toBe('sub-mf');
    expect('subCategoryId' in next.categories[0].items.find(i => i.id === 'ghost')!).toBe(false);
  });

  it('is idempotent', () => {
    const snap = snapshot([
      category({ items: [item({ id: 'ghost', subCategoryId: 'sub-deleted' })] }),
    ]);
    const once = pruneOrphanSubCategoryIds(snap);
    expect(pruneOrphanSubCategoryIds(once)).toBe(once);
  });

  it('never touches updatedAt', () => {
    const snap = snapshot([
      category({ items: [item({ id: 'ghost', subCategoryId: 'sub-deleted' })] }),
    ]);
    expect(pruneOrphanSubCategoryIds(snap).updatedAt).toBe(snap.updatedAt);
  });

  it('leaves untouched categories as the same object reference', () => {
    const clean = category({ id: 'cat-clean', items: [item({ id: 'x' })] });
    const dirty = category({
      id: 'cat-dirty',
      items: [item({ id: 'ghost', subCategoryId: 'sub-deleted' })],
    });

    const next = pruneOrphanSubCategoryIds(snapshot([clean, dirty]));
    expect(next.categories[0]).toBe(clean);
    expect(next.categories[1]).not.toBe(dirty);
  });
});

// ---------------------------------------------------------------------------
// buildSubCategoryAllocationData — the donut drill-down
// ---------------------------------------------------------------------------

describe('buildSubCategoryAllocationData', () => {
  it('returns one slice per non-empty group, largest first', () => {
    const snap = snapshot([mixedCategory()]);
    const data = buildSubCategoryAllocationData(snap, BASE, 'cat-inv');

    expect(data.map(d => d.name)).toEqual(['Mutual Funds', 'Stocks', 'Ungrouped']);
    expect(data.map(d => d.value)).toEqual([3000, 500, 250]);
  });

  it('makes percentages relative to the category, not to all assets', () => {
    const snap = snapshot([mixedCategory()]);
    const data = buildSubCategoryAllocationData(snap, BASE, 'cat-inv');

    const sum = data.reduce((n, d) => n + d.percentage, 0);
    expect(sum).toBeCloseTo(100, 6);
    expect(data[0].percentage).toBeCloseTo(3000 / 3750 * 100, 6);
  });

  it('labels the ungrouped bucket and gives it a stable id', () => {
    const snap = snapshot([mixedCategory()]);
    const ungrouped = buildSubCategoryAllocationData(snap, BASE, 'cat-inv')
      .find(d => d.name === 'Ungrouped');

    expect(ungrouped?.id).toBe('__ungrouped__');
  });

  it('folds the tail into an explicit Other (N) past nine slices', () => {
    const subs = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `Fund ${i}` }));
    const cat = category({
      subCategories: subs,
      // Descending so the smallest three are the ones folded away.
      items: subs.map((s, i) => item({ id: `i${i}`, amount: (12 - i) * 100, subCategoryId: s.id })),
    });

    const data = buildSubCategoryAllocationData(snapshot([cat]), BASE, 'cat-inv');

    expect(data).toHaveLength(MAX_ALLOCATION_SLICES);
    expect(data[data.length - 1].name).toBe('Other (4)');
    // Nothing is silently dropped — the folded slices still count toward 100%.
    expect(data.reduce((n, d) => n + d.percentage, 0)).toBeCloseTo(100, 6);
    expect(data.reduce((n, d) => n + d.value, 0))
      .toBeCloseTo(calcCategoryTotal(cat, BASE, RATES), 6);
  });

  it('does not fold when there are exactly nine slices', () => {
    const subs = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, name: `Fund ${i}` }));
    const cat = category({
      subCategories: subs,
      items: subs.map((s, i) => item({ id: `i${i}`, amount: 100, subCategoryId: s.id })),
    });

    const data = buildSubCategoryAllocationData(snapshot([cat]), BASE, 'cat-inv');
    expect(data).toHaveLength(9);
    expect(data.some(d => d.name.startsWith('Other'))).toBe(false);
  });

  it('returns [] for an unknown category or one with no value', () => {
    expect(buildSubCategoryAllocationData(snapshot([mixedCategory()]), BASE, 'nope')).toEqual([]);
    expect(buildSubCategoryAllocationData(snapshot([category()]), BASE, 'cat-inv')).toEqual([]);
  });

  it('excludes excluded items from the slices', () => {
    const cat = category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [
        item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf' }),
        item({ id: 'b', amount: 9999, subCategoryId: 'sub-mf', excludeFromNetWorth: true }),
      ],
    });

    const data = buildSubCategoryAllocationData(snapshot([cat]), BASE, 'cat-inv');
    expect(data[0].value).toBeCloseTo(1000, 6);
  });
});
