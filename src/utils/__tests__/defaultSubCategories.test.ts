import { describe, it, expect } from 'vitest';
import { DEFAULT_SUB_CATEGORIES, suggestedSubCategories } from '../defaultSubCategories';
import { DEFAULT_CATEGORY_TEMPLATES } from '../defaultCategories';
import { normalizeSubName } from '../subCategories';

describe('DEFAULT_SUB_CATEGORIES', () => {
  it('covers every built-in category', () => {
    const missing = DEFAULT_CATEGORY_TEMPLATES
      .map(t => t.id)
      .filter(id => !(id in DEFAULT_SUB_CATEGORIES));
    expect(missing).toEqual([]);
  });

  it('has no entries for categories that no longer exist', () => {
    const known = new Set(DEFAULT_CATEGORY_TEMPLATES.map(t => t.id));
    const orphans = Object.keys(DEFAULT_SUB_CATEGORIES).filter(id => !known.has(id));
    expect(orphans).toEqual([]);
  });

  it('gives every suggestion a non-empty name and description', () => {
    for (const [catId, list] of Object.entries(DEFAULT_SUB_CATEGORIES)) {
      expect(list.length, `${catId} has no suggestions`).toBeGreaterThan(0);
      for (const s of list) {
        expect(s.name.trim(), `${catId} has a nameless suggestion`).not.toBe('');
        expect(s.description.trim(), `${catId} > ${s.name} has no description`).not.toBe('');
      }
    }
  });

  /**
   * Two names that normalise identically would collide in ensureSubCategory: the
   * second would silently reuse the first and never be created, so the picker would
   * offer a group it cannot add.
   */
  it('has no names within a category that collide under normalizeSubName', () => {
    for (const [catId, list] of Object.entries(DEFAULT_SUB_CATEGORIES)) {
      const keys = list.map(s => normalizeSubName(s.name));
      expect(new Set(keys).size, `${catId} has colliding suggestion names`).toBe(keys.length);
    }
  });

  it('keeps descriptions to a readable length', () => {
    for (const list of Object.values(DEFAULT_SUB_CATEGORIES)) {
      for (const s of list) {
        expect(s.description.length, `${s.name} description is too long`).toBeLessThanOrEqual(140);
      }
    }
  });

  it('describes the NRE/NRO distinction, which is the point of having descriptions', () => {
    const cash = DEFAULT_SUB_CATEGORIES['default-cash'];
    const nre = cash.find(s => s.name === 'NRE')!;
    const nro = cash.find(s => s.name === 'NRO')!;
    expect(nre.description).toMatch(/repatriab/i);
    expect(nro.description).toMatch(/repatriation/i);
    expect(nre.description).not.toBe(nro.description);
  });
});

describe('suggestedSubCategories', () => {
  it('returns the catalogue entry for a built-in category, matched by id', () => {
    expect(suggestedSubCategories({ id: 'default-investments', name: 'Investments', type: 'asset' }).map(s => s.name))
      .toContain('Mutual Funds');
  });

  it('returns [] for a user-created category we have no opinion about', () => {
    expect(suggestedSubCategories({ id: crypto.randomUUID(), name: 'My Weird Category', type: 'asset' })).toEqual([]);
  });

  /**
   * The bug this guards against: a category whose stored id predates (or
   * otherwise doesn't match) the current `default-*` template ids — e.g.
   * older data, or anything created before stable ids existed — was
   * silently getting zero suggestions despite being unmistakably "Cash &
   * Bank Accounts" by name and type. `SnapshotEditor`'s backfill and
   * `buildCategoryTrendData` already tolerate this same mismatch via a
   * name+type fallback; this must too.
   */
  it('falls back to name+type when the id does not match any template', () => {
    const legacyIdCategory = { id: crypto.randomUUID(), name: 'Cash & Bank Accounts', type: 'asset' as const };
    expect(suggestedSubCategories(legacyIdCategory).map(s => s.name)).toContain('Fixed Deposits');
  });

  it('does not fall back across a type mismatch — same name, different type is a different category', () => {
    const wrongType = { id: crypto.randomUUID(), name: 'Cash & Bank Accounts', type: 'liability' as const };
    expect(suggestedSubCategories(wrongType)).toEqual([]);
  });

  it('prefers the direct id match over name+type when both could apply', () => {
    // A category correctly id'd as Investments but (hypothetically) renamed
    // should still get Investments' suggestions, not be misled by its name.
    const renamed = { id: 'default-investments', name: 'My Portfolio', type: 'asset' as const };
    expect(suggestedSubCategories(renamed).map(s => s.name)).toContain('Mutual Funds');
  });
});
