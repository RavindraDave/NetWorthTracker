/**
 * Tag-based allocation views — a reporting LENS across categories, not a
 * partition. An item with two tags counts fully in both, so totals here can
 * legitimately exceed net worth. Every consumer of this data must give tag
 * totals a visually separate presentation from net-worth/category totals
 * (no shared axis, no shared total row) rather than relying on a caption —
 * decided during implementation review, not optional polish.
 */
import { Snapshot } from '../types';
import { convertToBase } from './calculations';
import type { CategoryTrendPoint } from './calculations';

export interface TagAllocationItem {
  id: string;
  name: string;
  value: number;
  percentage: number;
}

/** Slices past this fold into a single "Other (N)" entry, matching `MAX_ALLOCATION_SLICES` elsewhere. */
const MAX_TAG_SLICES = 9;

/**
 * Value held under each tag in one snapshot, in base currency. Only tags with
 * at least one contributing item appear. Orphaned `tagIds` (no matching `Tag`
 * definition) are silently skipped — `pruneOrphanTagIds` is what cleans those
 * up at save time; this function just has to not crash on stale data.
 */
export function buildTagAllocationData(snapshot: Snapshot, baseCurrency: string): TagAllocationItem[] {
  const tags = snapshot.tags ?? [];
  if (tags.length === 0) return [];

  const totals = new Map<string, number>();
  for (const cat of snapshot.categories) {
    for (const item of cat.items) {
      if (item.excludeFromNetWorth || !item.tagIds?.length) continue;
      const value = convertToBase(item.amount, item.currency, baseCurrency, snapshot.exchangeRates);
      for (const tagId of item.tagIds) {
        totals.set(tagId, (totals.get(tagId) ?? 0) + value);
      }
    }
  }

  const slices: TagAllocationItem[] = tags
    .filter(t => (totals.get(t.id) ?? 0) > 0)
    .map(t => ({ id: t.id, name: t.name, value: totals.get(t.id)!, percentage: 0 }))
    .sort((a, b) => b.value - a.value);

  // Percentage is relative to the sum of tagged values, not net worth — tags
  // overlap by design, so there is no single denominator that means "whole".
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const withPct = slices.map(s => ({ ...s, percentage: total > 0 ? (s.value / total) * 100 : 0 }));

  if (withPct.length <= MAX_TAG_SLICES) return withPct;

  const head = withPct.slice(0, MAX_TAG_SLICES - 1);
  const tail = withPct.slice(MAX_TAG_SLICES - 1);
  const tailValue = tail.reduce((sum, s) => sum + s.value, 0);
  return [...head, {
    id: '__other__',
    name: `Other (${tail.length})`,
    value: tailValue,
    percentage: total > 0 ? (tailValue / total) * 100 : 0,
  }];
}

/**
 * 12-month value trend for a single tag, matched by id only (unlike
 * `buildCategoryTrendData`'s id-then-name fallback) — a tag that doesn't
 * exist on an earlier snapshot correctly contributes 0 for that month,
 * because tags are scoped per-snapshot by design.
 */
export function buildTagTrendData(
  snapshots: Snapshot[],
  baseCurrency: string,
  tagId: string,
): CategoryTrendPoint[] {
  return snapshots
    .slice(-12)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(snap => {
      let value = 0;
      for (const cat of snap.categories) {
        for (const item of cat.items) {
          if (item.excludeFromNetWorth || !item.tagIds?.includes(tagId)) continue;
          value += convertToBase(item.amount, item.currency, baseCurrency, snap.exchangeRates);
        }
      }
      const [year, month] = snap.month.split('-');
      const date = new Date(Number(year), Number(month) - 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { month: label, value: Math.round(value) };
    });
}
