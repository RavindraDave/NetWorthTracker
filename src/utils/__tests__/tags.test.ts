import { describe, it, expect } from 'vitest';
import {
  normalizeTagName,
  findTagIdByName,
  ensureTag,
  renameTag,
  deleteTag,
  pruneOrphanTagIds,
} from '../tags';
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

describe('normalizeTagName', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeTagName('  Retirement   Accounts ')).toBe('retirement accounts');
  });
});

describe('ensureTag', () => {
  it('creates a new tag when no case-insensitive match exists', () => {
    const { snapshot: next, id, created } = ensureTag(snapshot(), 'Emergency Fund');
    expect(created).toBe(true);
    expect(next.tags).toHaveLength(1);
    expect(next.tags![0]).toEqual({ id, name: 'Emergency Fund' });
  });

  it('reuses an existing tag on a case-insensitive match', () => {
    const snap = snapshot({ tags: [{ id: 't1', name: 'Retirement' }] });
    const { snapshot: next, id, created } = ensureTag(snap, '  retirement ');
    expect(created).toBe(false);
    expect(id).toBe('t1');
    expect(next).toBe(snap); // untouched — same reference
  });
});

describe('findTagIdByName', () => {
  it('is case-insensitive', () => {
    const snap = snapshot({ tags: [{ id: 't1', name: 'Retirement' }] });
    expect(findTagIdByName(snap, 'RETIREMENT')).toBe('t1');
    expect(findTagIdByName(snap, 'nope')).toBeUndefined();
  });
});

describe('renameTag', () => {
  it('renames when no collision', () => {
    const snap = snapshot({ tags: [{ id: 't1', name: 'Old' }] });
    const { snapshot: next, collidesWith } = renameTag(snap, 't1', 'New');
    expect(collidesWith).toBeUndefined();
    expect(next.tags![0].name).toBe('New');
  });

  it('reports a collision instead of renaming', () => {
    const snap = snapshot({ tags: [{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }] });
    const { snapshot: next, collidesWith } = renameTag(snap, 't1', 'b');
    expect(collidesWith).toBe('t2');
    expect(next).toBe(snap);
  });
});

describe('deleteTag', () => {
  it('removes the tag definition and strips it from EVERY category, not just one', () => {
    const snap = snapshot({
      tags: [{ id: 't1', name: 'Retirement' }, { id: 't2', name: 'Liquid' }],
      categories: [
        category({ id: 'c1', items: [item({ id: 'a', tagIds: ['t1', 't2'] })] }),
        category({ id: 'c2', type: 'liability', items: [item({ id: 'b', tagIds: ['t1'] })] }),
      ],
    });

    const next = deleteTag(snap, 't1');

    expect(next.tags).toEqual([{ id: 't2', name: 'Liquid' }]);
    // Item in the first category loses t1 but keeps t2.
    expect(next.categories[0].items[0].tagIds).toEqual(['t2']);
    // Item in the SECOND category (the cross-category case) also loses t1,
    // and since that was its only tag, the key is dropped entirely.
    expect(next.categories[1].items[0].tagIds).toBeUndefined();
  });

  it('never deletes items, only unfiles them', () => {
    const snap = snapshot({
      tags: [{ id: 't1', name: 'X' }],
      categories: [category({ items: [item({ id: 'a', tagIds: ['t1'] })] })],
    });
    const next = deleteTag(snap, 't1');
    expect(next.categories[0].items).toHaveLength(1);
  });
});

describe('pruneOrphanTagIds', () => {
  it('strips ids with no matching tag definition, across every category', () => {
    const snap = snapshot({
      tags: [{ id: 't1', name: 'Kept' }],
      categories: [
        category({ id: 'c1', items: [item({ id: 'a', tagIds: ['t1', 'ghost'] })] }),
        category({ id: 'c2', type: 'liability', items: [item({ id: 'b', tagIds: ['ghost'] })] }),
      ],
    });

    const next = pruneOrphanTagIds(snap);
    expect(next.categories[0].items[0].tagIds).toEqual(['t1']);
    expect(next.categories[1].items[0].tagIds).toBeUndefined();
  });

  it('returns the SAME reference when nothing is orphaned (no spurious sync conflict)', () => {
    const snap = snapshot({
      tags: [{ id: 't1', name: 'Kept' }],
      categories: [category({ items: [item({ id: 'a', tagIds: ['t1'] })] })],
    });
    expect(pruneOrphanTagIds(snap)).toBe(snap);
  });

  it('is a no-op on a snapshot with no tags at all', () => {
    const snap = snapshot({ categories: [category({ items: [item({ id: 'a' })] })] });
    expect(pruneOrphanTagIds(snap)).toBe(snap);
  });
});
