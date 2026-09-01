import { describe, it, expect } from 'vitest';
import { reconcileCategoryIds } from '../categoryReconciliation';
import { Category, Goal, Snapshot } from '../../types';

function cat(overrides: Partial<Category> & { id: string; name: string; type: 'asset' | 'liability' }): Category {
  return { icon: '', isLiquid: true, isInvestable: true, items: [], ...overrides };
}

function snap(month: string, categories: Category[]): Snapshot {
  return { id: `s-${month}`, month, createdAt: '', updatedAt: '2026-01-01T00:00:00.000Z', exchangeRates: {}, categories };
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return { id: 'g1', type: 'fire', name: 'FIRE', createdAt: '', targetAmount: 0, ...overrides };
}

describe('reconcileCategoryIds', () => {
  it('rewrites a legacy id to the canonical template id when name+type match unambiguously', () => {
    const legacy = cat({ id: 'legacy-uuid-1', name: 'Cash & Bank Accounts', type: 'asset' });
    const result = reconcileCategoryIds([snap('2026-01', [legacy])], []);

    expect(result.fixed).toEqual([{ oldId: 'legacy-uuid-1', newId: 'default-cash', categoryName: 'Cash & Bank Accounts' }]);
    expect(result.conflicts).toEqual([]);
    expect(result.snapshots[0].categories[0].id).toBe('default-cash');
  });

  it('bumps updatedAt only on snapshots it actually changes', () => {
    const legacy = cat({ id: 'legacy-uuid-1', name: 'Cash & Bank Accounts', type: 'asset' });
    const alreadyCanonical = cat({ id: 'default-investments', name: 'Investments', type: 'asset' });
    const changed = snap('2026-01', [legacy]);
    const untouched = snap('2026-02', [alreadyCanonical]);
    const result = reconcileCategoryIds([changed, untouched], []);

    expect(result.snapshots[0].updatedAt).not.toBe(changed.updatedAt);
    expect(result.snapshots[1]).toBe(untouched); // same reference — nothing to do
  });

  it('leaves a custom category (no matching template) untouched, with no conflict reported', () => {
    const custom = cat({ id: 'custom-1', name: 'Crypto Wallets', type: 'asset' });
    const result = reconcileCategoryIds([snap('2026-01', [custom])], []);
    expect(result.fixed).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.snapshots[0].categories[0].id).toBe('custom-1');
  });

  it('updates Goal.excludedCategoryIds to the new id in the same pass', () => {
    const legacy = cat({ id: 'legacy-uuid-1', name: 'Real Estate', type: 'asset' });
    const g = goal({ excludedCategoryIds: ['legacy-uuid-1'] });
    const result = reconcileCategoryIds([snap('2026-01', [legacy])], [g]);

    expect(result.goals[0].excludedCategoryIds).toEqual(['default-real-estate']);
  });

  it('dedupes excludedCategoryIds if the rewrite would create a duplicate', () => {
    const legacy = cat({ id: 'legacy-uuid-1', name: 'Real Estate', type: 'asset' });
    // Goal already (redundantly) excludes both the legacy id and the canonical one.
    const g = goal({ excludedCategoryIds: ['legacy-uuid-1', 'default-real-estate'] });
    const result = reconcileCategoryIds([snap('2026-01', [legacy])], [g]);

    expect(result.goals[0].excludedCategoryIds).toEqual(['default-real-estate']);
  });

  it('leaves a goal with no reference to the changed category untouched (same reference)', () => {
    const legacy = cat({ id: 'legacy-uuid-1', name: 'Real Estate', type: 'asset' });
    const g = goal({ excludedCategoryIds: ['some-other-category'] });
    const result = reconcileCategoryIds([snap('2026-01', [legacy])], [g]);
    expect(result.goals[0]).toBe(g);
  });

  it('reports a conflict — and fixes nothing for that id — when the same old id resolves differently across snapshots', () => {
    const asRealEstate = cat({ id: 'legacy-uuid-1', name: 'Real Estate', type: 'asset' });
    const asBusiness   = cat({ id: 'legacy-uuid-1', name: 'Business', type: 'asset' });
    const result = reconcileCategoryIds([snap('2026-01', [asRealEstate]), snap('2026-02', [asBusiness])], []);

    expect(result.fixed).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.snapshots[0].categories[0].id).toBe('legacy-uuid-1');
    expect(result.snapshots[1].categories[0].id).toBe('legacy-uuid-1');
  });

  it('reports a conflict — and fixes neither — when two categories in the same snapshot would collide on the same canonical id', () => {
    const legacyA = cat({ id: 'legacy-uuid-a', name: 'Cash & Bank Accounts', type: 'asset' });
    const legacyB = cat({ id: 'legacy-uuid-b', name: 'Cash & Bank Accounts', type: 'asset' });
    const result = reconcileCategoryIds([snap('2026-01', [legacyA, legacyB])], []);

    expect(result.fixed).toEqual([]);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.snapshots[0].categories.map(c => c.id)).toEqual(['legacy-uuid-a', 'legacy-uuid-b']);
  });

  it('is idempotent — running it again on already-reconciled data is a no-op', () => {
    const legacy = cat({ id: 'legacy-uuid-1', name: 'Cash & Bank Accounts', type: 'asset' });
    const first = reconcileCategoryIds([snap('2026-01', [legacy])], []);
    const second = reconcileCategoryIds(first.snapshots, first.goals);

    expect(second.fixed).toEqual([]);
    expect(second.conflicts).toEqual([]);
    expect(second.snapshots).toBe(first.snapshots);
  });

  it('unifies independently-drifted ids for the same category across separate months into one canonical id', () => {
    // Simulates repeated CSV imports into brand-new months, each minting its
    // own fresh random id for "the same" real-world category.
    const augustImport = cat({ id: 'uuid-aug', name: 'Cash & Bank Accounts', type: 'asset' });
    const septemberImport = cat({ id: 'uuid-sep', name: 'Cash & Bank Accounts', type: 'asset' });
    const result = reconcileCategoryIds([snap('2026-08', [augustImport]), snap('2026-09', [septemberImport])], []);

    expect(result.snapshots[0].categories[0].id).toBe('default-cash');
    expect(result.snapshots[1].categories[0].id).toBe('default-cash');
    expect(result.fixed).toHaveLength(2);
  });

  it('returns the same snapshots/goals arrays (not just equal ones) when there is nothing to fix', () => {
    const snapshots = [snap('2026-01', [cat({ id: 'default-cash', name: 'Cash & Bank Accounts', type: 'asset' })])];
    const goals = [goal()];
    const result = reconcileCategoryIds(snapshots, goals);
    expect(result.snapshots[0]).toBe(snapshots[0]);
    expect(result.goals[0]).toBe(goals[0]);
  });
});
