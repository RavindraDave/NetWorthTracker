/**
 * Finds categories whose stored id predates (or otherwise doesn't match) the
 * current built-in template ids, but which are unmistakably one of those
 * templates by name+type — the same identity test `SnapshotEditor`'s
 * category backfill and `buildCategoryTrendData` already use — and rewrites
 * their id to the canonical one everywhere it appears, keeping
 * `Goal.excludedCategoryIds` in sync in the same pass so an exclusion never
 * silently stops applying just because the category it names got a new id
 * out from under it.
 *
 * Read-only over the input: every candidate fix is computed from the
 * ORIGINAL data first, then only the fixes with no collision risk are
 * applied — so the result never depends on the order categories happen to
 * be visited in.
 *
 * A fix is applied only when unambiguous:
 *   - the old id must resolve to exactly one candidate template by name+type
 *   - that SAME old id must resolve to that SAME candidate in every
 *     snapshot it appears in (a legacy id that resolves two different ways
 *     across different months means something inconsistent happened to the
 *     data, not a simple drifted id)
 *   - applying it must never make two categories share one id within any
 *     single snapshot
 * Anything else is left untouched and reported as a conflict for manual
 * attention — deliberately not auto-resolved, since guessing wrong here
 * could silently merge two genuinely different categories.
 */
import { Category, Goal, Snapshot } from '../types';
import { DEFAULT_CATEGORY_TEMPLATES } from './defaultCategories';

export interface CategoryIdFix {
  oldId: string;
  newId: string;
  categoryName: string;
}

export interface CategoryIdConflict {
  categoryName: string;
  reason: string;
}

export interface ReconciliationResult {
  snapshots: Snapshot[];
  goals: Goal[];
  fixed: CategoryIdFix[];
  conflicts: CategoryIdConflict[];
}

const TEMPLATE_IDS = new Set(DEFAULT_CATEGORY_TEMPLATES.map(t => t.id));

function candidateTemplateId(cat: Category): string | undefined {
  const matches = DEFAULT_CATEGORY_TEMPLATES.filter(t => t.name === cat.name && t.type === cat.type);
  return matches.length === 1 ? matches[0].id : undefined;
}

export function reconcileCategoryIds(snapshots: Snapshot[], goals: Goal[]): ReconciliationResult {
  // 1. Candidate old->new id, computed once from the untouched input.
  const candidatesByOldId = new Map<string, Set<string>>();
  const nameByOldId = new Map<string, string>();

  for (const snap of snapshots) {
    for (const cat of snap.categories) {
      if (TEMPLATE_IDS.has(cat.id)) continue; // already canonical
      const candidate = candidateTemplateId(cat);
      if (!candidate) continue; // custom category, or ambiguous by name+type — not our problem
      if (!candidatesByOldId.has(cat.id)) candidatesByOldId.set(cat.id, new Set());
      candidatesByOldId.get(cat.id)!.add(candidate);
      nameByOldId.set(cat.id, cat.name);
    }
  }

  const conflicts: CategoryIdConflict[] = [];
  const safeMapping = new Map<string, string>();

  for (const [oldId, candidates] of candidatesByOldId) {
    if (candidates.size > 1) {
      conflicts.push({
        categoryName: nameByOldId.get(oldId)!,
        reason: `"${nameByOldId.get(oldId)}" resolves to different built-in categories across different snapshots — left unchanged.`,
      });
      continue;
    }
    safeMapping.set(oldId, [...candidates][0]);
  }

  // 2. Same-snapshot collision check: would applying safeMapping put two
  //    categories under the same id within any one snapshot?
  const blockedOldIds = new Set<string>();
  for (const snap of snapshots) {
    const finalIdCounts = new Map<string, number>();
    for (const cat of snap.categories) {
      const finalId = safeMapping.get(cat.id) ?? cat.id;
      finalIdCounts.set(finalId, (finalIdCounts.get(finalId) ?? 0) + 1);
    }
    for (const cat of snap.categories) {
      const mapped = safeMapping.get(cat.id);
      if (!mapped) continue; // not one we're touching — can't be "blocked"
      if ((finalIdCounts.get(mapped) ?? 0) > 1) blockedOldIds.add(cat.id);
    }
  }
  for (const oldId of blockedOldIds) {
    safeMapping.delete(oldId);
    conflicts.push({
      categoryName: nameByOldId.get(oldId)!,
      reason: `"${nameByOldId.get(oldId)}" would collide with another category in the same month — left unchanged.`,
    });
  }

  if (safeMapping.size === 0) {
    return { snapshots, goals, fixed: [], conflicts };
  }

  // 3. Apply.
  const fixed: CategoryIdFix[] = [...safeMapping.entries()].map(([oldId, newId]) => ({
    oldId, newId, categoryName: nameByOldId.get(oldId)!,
  }));

  const nextSnapshots = snapshots.map(snap => {
    let changed = false;
    const categories = snap.categories.map(cat => {
      const newId = safeMapping.get(cat.id);
      if (!newId) return cat;
      changed = true;
      return { ...cat, id: newId };
    });
    return changed ? { ...snap, categories, updatedAt: new Date().toISOString() } : snap;
  });

  const nextGoals = goals.map(goal => {
    if (!goal.excludedCategoryIds?.length) return goal;
    let changed = false;
    const seen = new Set<string>();
    const nextIds: string[] = [];
    for (const id of goal.excludedCategoryIds) {
      const mapped = safeMapping.get(id) ?? id;
      if (mapped !== id) changed = true;
      if (seen.has(mapped)) { changed = true; continue; } // now a duplicate — drop it
      seen.add(mapped);
      nextIds.push(mapped);
    }
    return changed ? { ...goal, excludedCategoryIds: nextIds, updatedAt: new Date().toISOString() } : goal;
  });

  return { snapshots: nextSnapshots, goals: nextGoals, fixed, conflicts };
}
