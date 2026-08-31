import { describe, it, expect } from 'vitest';
import { buildTagAllocationData, buildTagTrendData } from '../tagAggregation';
import { Category, LineItem, Snapshot } from '../../types';

function item(overrides: Partial<LineItem> & { id: string }): LineItem {
  return { name: `Item ${overrides.id}`, amount: 100, currency: 'INR', ...overrides };
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-inv', name: 'Investments', type: 'asset', icon: '📈',
    isLiquid: true, isInvestable: true, items: [], ...overrides,
  };
}

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 'snap-1', month: '2026-08', createdAt: '', updatedAt: '',
    exchangeRates: {}, categories: [], ...overrides,
  };
}

describe('buildTagAllocationData', () => {
  it('sums an item under every tag it carries — double counting is intentional', () => {
    const snap = snapshot({
      tags: [{ id: 't1', name: 'Retirement' }, { id: 't2', name: 'Liquid' }],
      categories: [
        category({ id: 'c1', items: [item({ id: 'a', amount: 1000, tagIds: ['t1', 't2'] })] }),
        category({ id: 'c2', items: [item({ id: 'b', amount: 500, tagIds: ['t1'] })] }),
      ],
    });

    const data = buildTagAllocationData(snap, 'INR');
    const byName = Object.fromEntries(data.map(d => [d.name, d.value]));
    expect(byName['Retirement']).toBe(1500); // both items
    expect(byName['Liquid']).toBe(1000); // only the shared item
    // Total across tags (2500) exceeds the actual net worth of the two items (1500) —
    // this is the expected overlap, not a bug.
  });

  it('excludes items marked excludeFromNetWorth', () => {
    const snap = snapshot({
      tags: [{ id: 't1', name: 'X' }],
      categories: [category({ items: [item({ id: 'a', amount: 1000, tagIds: ['t1'], excludeFromNetWorth: true })] })],
    });
    expect(buildTagAllocationData(snap, 'INR')).toEqual([]);
  });

  it('ignores orphaned tagIds without crashing', () => {
    const snap = snapshot({
      tags: [],
      categories: [category({ items: [item({ id: 'a', amount: 1000, tagIds: ['ghost'] })] })],
    });
    expect(buildTagAllocationData(snap, 'INR')).toEqual([]);
  });

  it('returns [] when the snapshot has no tags defined', () => {
    const snap = snapshot({ categories: [category({ items: [item({ id: 'a' })] })] });
    expect(buildTagAllocationData(snap, 'INR')).toEqual([]);
  });
});

describe('buildTagTrendData', () => {
  it('contributes 0 for a month before the tag existed (per-snapshot scoping)', () => {
    const early = snapshot({ id: 's1', month: '2026-06', categories: [category({ items: [item({ id: 'a', amount: 500 })] })] });
    const later = snapshot({
      id: 's2', month: '2026-07',
      tags: [{ id: 't1', name: 'New Tag' }],
      categories: [category({ items: [item({ id: 'a', amount: 500, tagIds: ['t1'] })] })],
    });

    const trend = buildTagTrendData([early, later], 'INR', 't1');
    expect(trend[0].value).toBe(0);
    expect(trend[1].value).toBe(500);
  });
});
