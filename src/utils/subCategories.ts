/**
 * Sub-categories — one optional grouping level between a Category and its items.
 *
 * The whole feature rests on one invariant: `Category.items` stays a FLAT array.
 * Grouping is a reference (`LineItem.subCategoryId`) resolved at render time, never
 * a nested container. That is why `calcCategoryTotal`, `calcNetWorth`,
 * `buildCurrencyAllocationData`, `filterByViewMode` and the entire cloud-sync merge
 * needed no changes to support this.
 *
 * Every transform here is immutable and returns a new Category. That is not just
 * style: `cloneLatestSnapshot` reuses category *object references* between months
 * (`categories: existing`), so an in-place mutation would silently rewrite the
 * previous month's snapshot too.
 */
import { Category, LineItem, Snapshot, SubCategory } from '../types';
import { convertToBase } from './calculations';

/**
 * The single dedupe key: trim, collapse internal whitespace, lowercase.
 * `'  mutual   FUNDS '` and `'Mutual Funds'` normalise to the same string, which is
 * what stops a typo from creating a second group.
 */
export function normalizeSubName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export interface SubCategoryGroup {
  /** null = the ungrouped bucket. */
  id: string | null;
  /** '' for the ungrouped bucket — the caller supplies the display label. */
  name: string;
  /** ALL items in the bucket, including excluded ones (the editor still renders those). */
  items: LineItem[];
  /** Base currency, exclusion-aware — same filter rule as `calcCategoryTotal`. */
  total: number;
}

/**
 * Partition a category's items into its sub-category groups.
 *
 * Order: defined groups in `subCategories` array order, then the ungrouped bucket LAST.
 * An item whose `subCategoryId` matches no definition falls into the ungrouped bucket,
 * so orphaned references degrade to "visible and editable" rather than disappearing.
 *
 * Invariants (asserted in the unit tests):
 *   sum(g.items.length) === category.items.length
 *   sum(g.total)        === calcCategoryTotal(category, base, rates, forGoals)
 */
export function groupItemsBySubCategory(
  category: Category,
  baseCurrency: string,
  exchangeRates: Record<string, number>,
  opts: { forGoals?: boolean; includeEmpty?: boolean } = {},
): SubCategoryGroup[] {
  const { forGoals = false, includeEmpty = false } = opts;
  const defs = category.subCategories ?? [];

  const buckets = new Map<string, LineItem[]>();
  for (const def of defs) buckets.set(def.id, []);
  const ungrouped: LineItem[] = [];

  for (const item of category.items) {
    const bucket = item.subCategoryId ? buckets.get(item.subCategoryId) : undefined;
    (bucket ?? ungrouped).push(item);
  }

  const totalOf = (items: LineItem[]) =>
    items
      .filter(i => !i.excludeFromNetWorth && !(forGoals && i.excludeFromGoals))
      .reduce((sum, i) => sum + convertToBase(i.amount, i.currency, baseCurrency, exchangeRates), 0);

  const groups: SubCategoryGroup[] = [];
  for (const def of defs) {
    const items = buckets.get(def.id) ?? [];
    if (items.length === 0 && !includeEmpty) continue;
    groups.push({ id: def.id, name: def.name, items, total: totalOf(items) });
  }

  // The ungrouped bucket is included whenever it holds anything. When `includeEmpty`
  // is set (the editor) it is always present, so there is somewhere to add an
  // ungrouped item even after every existing one has been filed into a group.
  if (ungrouped.length > 0 || includeEmpty) {
    groups.push({ id: null, name: '', items: ungrouped, total: totalOf(ungrouped) });
  }

  return groups;
}

/** Display name for exports. undefined when ungrouped or the reference is orphaned. */
export function subCategoryName(cat: Category, id?: string): string | undefined {
  if (!id) return undefined;
  return cat.subCategories?.find(s => s.id === id)?.name;
}

/** Case-insensitive lookup by name. Pure — used by the in-place CSV import loop. */
export function findSubCategoryIdByName(cat: Category, rawName: string): string | undefined {
  const key = normalizeSubName(rawName);
  if (!key) return undefined;
  return cat.subCategories?.find(s => normalizeSubName(s.name) === key)?.id;
}

/**
 * Immutable find-or-create. `created: false` means a case-insensitive match already
 * existed and was reused — typing "mutual funds" converges on "Mutual Funds" rather
 * than adding a near-duplicate.
 */
export function ensureSubCategory(
  cat: Category,
  rawName: string,
): { category: Category; id: string; created: boolean } {
  const name = rawName.trim().replace(/\s+/g, ' ');
  const existing = findSubCategoryIdByName(cat, name);
  if (existing) return { category: cat, id: existing, created: false };

  const id = crypto.randomUUID();
  return {
    category: { ...cat, subCategories: [...(cat.subCategories ?? []), { id, name }] },
    id,
    created: true,
  };
}

/**
 * Rename a group. On a case-insensitive collision with a *different* group this
 * returns `collidesWith` and leaves the category untouched, so the caller can offer
 * a merge instead of silently creating a duplicate.
 */
export function renameSubCategory(
  cat: Category,
  id: string,
  rawName: string,
): { category: Category; collidesWith?: string } {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) return { category: cat };

  const clash = cat.subCategories?.find(
    s => s.id !== id && normalizeSubName(s.name) === normalizeSubName(name),
  );
  if (clash) return { category: cat, collidesWith: clash.id };

  return {
    category: {
      ...cat,
      subCategories: (cat.subCategories ?? []).map(s => (s.id === id ? { ...s, name } : s)),
    },
  };
}

/**
 * Remove a group definition and unfile its items. Items are NEVER deleted — this is
 * deliberately the opposite of the category-level delete guard, because a sub-group
 * is organisational and removing it changes no total.
 */
export function deleteSubCategory(cat: Category, id: string): Category {
  return {
    ...cat,
    subCategories: (cat.subCategories ?? []).filter(s => s.id !== id),
    items: cat.items.map(i => (i.subCategoryId === id ? stripSubCategoryId(i) : i)),
  };
}

/** Move every item from `fromId` into `intoId` and drop the `fromId` definition. */
export function mergeSubCategories(cat: Category, fromId: string, intoId: string): Category {
  if (fromId === intoId) return cat;
  const targetExists = (cat.subCategories ?? []).some(s => s.id === intoId);
  if (!targetExists) return cat;

  return {
    ...cat,
    subCategories: (cat.subCategories ?? []).filter(s => s.id !== fromId),
    items: cat.items.map(i => (i.subCategoryId === fromId ? { ...i, subCategoryId: intoId } : i)),
  };
}

/**
 * Reorder by swapping array positions — array order IS display order, which is how
 * this feature gets an ordering control the rest of the model still lacks.
 * Clamps at the ends rather than wrapping.
 */
export function moveSubCategory(cat: Category, id: string, delta: -1 | 1): Category {
  const defs = cat.subCategories ?? [];
  const from = defs.findIndex(s => s.id === id);
  if (from === -1) return cat;
  const to = from + delta;
  if (to < 0 || to >= defs.length) return cat;

  const next = [...defs];
  [next[from], next[to]] = [next[to], next[from]];
  return { ...cat, subCategories: next };
}

/** Drop `subCategoryId` without leaving an explicit `undefined` key on the item. */
function stripSubCategoryId(item: LineItem): LineItem {
  const { subCategoryId: _dropped, ...rest } = item;
  return rest;
}

/**
 * Self-heal orphaned references at save time.
 *
 * Returns the SAME snapshot reference when nothing is orphaned — which is virtually
 * every save — so this never manufactures a write. It deliberately does not touch
 * `updatedAt`: the sync engine treats any `updatedAt` change as "locally modified",
 * so a blanket rewrite would produce a conflict storm on the next pull.
 */
export function pruneOrphanSubCategoryIds(snap: Snapshot): Snapshot {
  let changed = false;

  const categories = snap.categories.map(cat => {
    const known = new Set((cat.subCategories ?? []).map(s => s.id));
    if (!cat.items.some(i => i.subCategoryId && !known.has(i.subCategoryId))) return cat;

    changed = true;
    return {
      ...cat,
      items: cat.items.map(i =>
        i.subCategoryId && !known.has(i.subCategoryId) ? stripSubCategoryId(i) : i,
      ),
    };
  });

  return changed ? { ...snap, categories } : snap;
}

/** Convenience for the editor: does this category have any groups defined? */
export function hasSubCategories(cat: Category): boolean {
  return (cat.subCategories?.length ?? 0) > 0;
}

export type { SubCategory };
