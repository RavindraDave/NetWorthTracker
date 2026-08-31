/**
 * Tags — a user-defined label that can span multiple categories, for reporting
 * only. Mirrors `subCategories.ts`'s API and invariants deliberately: same
 * normalize/find-or-create/rename shape, same immutability discipline (every
 * transform returns a new `Snapshot`; `cloneLatestSnapshot` reuses object
 * references between months, so an in-place mutation would silently rewrite
 * the previous month's snapshot too).
 *
 * The one place this diverges from `subCategories.ts`: a tag reference
 * (`LineItem.tagIds`) is an array, and `Snapshot.tags` is a sibling of
 * `categories`, not a child of one — so deleting a tag must sweep every
 * category's items in the snapshot, not just one category's.
 */
import { Category, LineItem, Snapshot, Tag } from '../types';

export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Case-insensitive lookup by name. */
export function findTagIdByName(snap: Snapshot, rawName: string): string | undefined {
  const key = normalizeTagName(rawName);
  if (!key) return undefined;
  return snap.tags?.find(t => normalizeTagName(t.name) === key)?.id;
}

/**
 * Immutable find-or-create on the snapshot's tag registry. `created: false`
 * means a case-insensitive match already existed and was reused.
 */
export function ensureTag(
  snap: Snapshot,
  rawName: string,
): { snapshot: Snapshot; id: string; created: boolean } {
  const name = rawName.trim().replace(/\s+/g, ' ');
  const existing = findTagIdByName(snap, name);
  if (existing) return { snapshot: snap, id: existing, created: false };

  const id = crypto.randomUUID();
  const tag: Tag = { id, name };
  return {
    snapshot: { ...snap, tags: [...(snap.tags ?? []), tag] },
    id,
    created: true,
  };
}

/**
 * Rename a tag. On a case-insensitive collision with a *different* tag,
 * returns `collidesWith` and leaves the snapshot untouched, so the caller can
 * offer a merge instead of silently creating a duplicate.
 */
export function renameTag(
  snap: Snapshot,
  id: string,
  rawName: string,
): { snapshot: Snapshot; collidesWith?: string } {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) return { snapshot: snap };

  const clash = snap.tags?.find(t => t.id !== id && normalizeTagName(t.name) === normalizeTagName(name));
  if (clash) return { snapshot: snap, collidesWith: clash.id };

  return {
    snapshot: {
      ...snap,
      tags: (snap.tags ?? []).map(t => (t.id === id ? { ...t, name } : t)),
    },
  };
}

/** Drop `tagId` from an item's `tagIds` without leaving an empty array behind. */
function stripTagId(item: LineItem, tagId: string): LineItem {
  if (!item.tagIds?.includes(tagId)) return item;
  const next = item.tagIds.filter(id => id !== tagId);
  const { tagIds: _dropped, ...rest } = item;
  return next.length > 0 ? { ...rest, tagIds: next } : rest;
}

/**
 * Remove a tag definition and strip it from every item's `tagIds` across
 * EVERY category in the snapshot — unlike `deleteSubCategory`, this cannot be
 * scoped to one category, because a tag is cross-category by definition.
 * Items are never deleted, only unfiled.
 */
export function deleteTag(snap: Snapshot, id: string): Snapshot {
  return {
    ...snap,
    tags: (snap.tags ?? []).filter(t => t.id !== id),
    categories: snap.categories.map((cat: Category) => ({
      ...cat,
      items: cat.items.map(i => stripTagId(i, id)),
    })),
  };
}

/**
 * Self-heal orphaned `tagIds` at save time — mirrors
 * `pruneOrphanSubCategoryIds`. Returns the SAME snapshot reference when
 * nothing is orphaned, and deliberately does not touch `updatedAt` (the sync
 * engine treats any `updatedAt` change as "locally modified"; a blanket
 * rewrite here would manufacture a conflict on the next pull).
 */
export function pruneOrphanTagIds(snap: Snapshot): Snapshot {
  const known = new Set((snap.tags ?? []).map(t => t.id));
  let changed = false;

  const categories = snap.categories.map(cat => {
    if (!cat.items.some(i => i.tagIds?.some(id => !known.has(id)))) return cat;
    changed = true;
    return {
      ...cat,
      items: cat.items.map(i => {
        if (!i.tagIds?.some(id => !known.has(id))) return i;
        const next = i.tagIds.filter(id => known.has(id));
        const { tagIds: _dropped, ...rest } = i;
        return next.length > 0 ? { ...rest, tagIds: next } : rest;
      }),
    };
  });

  return changed ? { ...snap, categories } : snap;
}

export type { Tag };
