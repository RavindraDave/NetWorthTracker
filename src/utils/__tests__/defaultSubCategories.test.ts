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
  it('returns the catalogue entry for a built-in category', () => {
    expect(suggestedSubCategories('default-investments').map(s => s.name))
      .toContain('Mutual Funds');
  });

  it('returns [] for a user-created category we have no opinion about', () => {
    expect(suggestedSubCategories(crypto.randomUUID())).toEqual([]);
  });
});
