// Three-way merge for WealthPulse backups.
// Keys: snapshots by month, goals by id. Preferences are always kept local.
//
// Conflict rule: both local and remote changed the same record relative to base
// and the changes are different → surface for user resolution.
//
// When base is null (first sync / meta cleared): fall back to last-write-wins
// using updatedAt timestamps.

import { BackupData } from '../importExport';
import { Snapshot, Goal } from '../../types';

export interface SyncConflict {
  kind: 'snapshot' | 'goal';
  key: string;      // month for snapshot, id for goal
  label: string;    // human-readable name for the UI
  local: Snapshot | Goal;
  remote: Snapshot | Goal;
}

export interface SyncResult {
  /** The auto-resolved merged data. Conflicts still contain the local value here. */
  merged: BackupData;
  /** Items that need user resolution. */
  conflicts: SyncConflict[];
}

function newerOf<T extends { updatedAt?: string; createdAt?: string }>(a: T, b: T): T {
  const ta = a.updatedAt ?? a.createdAt ?? '';
  const tb = b.updatedAt ?? b.createdAt ?? '';
  return ta >= tb ? a : b;
}

// ── Snapshot merge ────────────────────────────────────────────────────────────

function mergeSnapshots(
  base: Snapshot[] | null,
  local: Snapshot[],
  remote: Snapshot[],
): { merged: Snapshot[]; conflicts: SyncConflict[] } {
  const baseMap  = new Map((base ?? []).map(s => [s.month, s]));
  const localMap = new Map(local.map(s => [s.month, s]));
  const remoteMap = new Map(remote.map(s => [s.month, s]));
  const allMonths = new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()]);

  const merged: Snapshot[] = [];
  const conflicts: SyncConflict[] = [];

  for (const month of allMonths) {
    const b = baseMap.get(month);
    const l = localMap.get(month);
    const r = remoteMap.get(month);

    if (!l && !r) continue; // deleted on both sides (or only in base)

    if (l && !r) {
      // Remote doesn't have it
      if (b) continue; // remote deleted it — respect deletion
      merged.push(l); // new local snapshot not yet on remote → include
      continue;
    }
    if (r && !l) {
      // Local doesn't have it
      if (b) continue; // local deleted it — respect deletion
      merged.push(r); // new remote snapshot → include
      continue;
    }

    // Both sides have it
    const ls = l!;
    const rs = r!;

    if (!b) {
      // No base — last-write-wins
      const winner = newerOf(ls, rs);
      if (ls.updatedAt === rs.updatedAt) {
        merged.push(ls); // identical edit time → same data
      } else {
        merged.push(winner);
      }
      continue;
    }

    const localChanged  = ls.updatedAt !== b.updatedAt;
    const remoteChanged = rs.updatedAt !== b.updatedAt;

    if (!localChanged && !remoteChanged) { merged.push(ls); continue; }
    if (localChanged  && !remoteChanged) { merged.push(ls); continue; }
    if (!localChanged && remoteChanged)  { merged.push(rs); continue; }

    // Both changed
    if (ls.updatedAt === rs.updatedAt) {
      merged.push(ls); // concurrent identical update
    } else {
      conflicts.push({ kind: 'snapshot', key: month, label: month, local: ls, remote: rs });
      merged.push(ls); // placeholder — will be replaced after resolution
    }
  }

  return { merged, conflicts };
}

// ── Goal merge ────────────────────────────────────────────────────────────────

function mergeGoals(
  base: Goal[] | null,
  local: Goal[],
  remote: Goal[],
): { merged: Goal[]; conflicts: SyncConflict[] } {
  const baseMap   = new Map((base ?? []).map(g => [g.id, g]));
  const localMap  = new Map(local.map(g => [g.id, g]));
  const remoteMap = new Map(remote.map(g => [g.id, g]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()]);

  const merged: Goal[] = [];
  const conflicts: SyncConflict[] = [];

  for (const id of allIds) {
    const b = baseMap.get(id);
    const l = localMap.get(id);
    const r = remoteMap.get(id);

    if (!l && !r) continue;

    if (l && !r) {
      if (b) continue; // remote deleted
      merged.push(l);
      continue;
    }
    if (r && !l) {
      if (b) continue; // local deleted
      merged.push(r);
      continue;
    }

    const lg = l!;
    const rg = r!;

    if (!b) {
      merged.push(newerOf(lg, rg));
      continue;
    }

    const localChanged  = (lg.updatedAt ?? lg.createdAt) !== (b.updatedAt ?? b.createdAt);
    const remoteChanged = (rg.updatedAt ?? rg.createdAt) !== (b.updatedAt ?? b.createdAt);

    if (!localChanged && !remoteChanged) { merged.push(lg); continue; }
    if (localChanged  && !remoteChanged) { merged.push(lg); continue; }
    if (!localChanged && remoteChanged)  { merged.push(rg); continue; }

    if ((lg.updatedAt ?? lg.createdAt) === (rg.updatedAt ?? rg.createdAt)) {
      merged.push(lg);
    } else {
      conflicts.push({ kind: 'goal', key: id, label: lg.name, local: lg, remote: rg });
      merged.push(lg); // placeholder
    }
  }

  return { merged, conflicts };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function mergeBackups(
  base: BackupData | null,
  local: BackupData,
  remote: BackupData,
): SyncResult {
  const snapResult = mergeSnapshots(base?.snapshots ?? null, local.snapshots, remote.snapshots);
  const goalResult = mergeGoals(base?.goals ?? null, local.goals, remote.goals);

  const merged: BackupData = {
    version: 1,
    exportDate: new Date().toISOString(),
    snapshots: snapResult.merged.sort((a, b) => a.month.localeCompare(b.month)),
    goals: goalResult.merged,
    preferences: local.preferences, // always keep local preferences
  };

  return {
    merged,
    conflicts: [...snapResult.conflicts, ...goalResult.conflicts],
  };
}

export function applyResolutions(
  result: SyncResult,
  resolutions: Map<string, 'local' | 'remote'>,
): BackupData {
  const snapshots = result.merged.snapshots.map(s => {
    const conflict = result.conflicts.find(c => c.kind === 'snapshot' && c.key === s.month);
    if (!conflict) return s;
    const choice = resolutions.get(s.month) ?? 'local';
    return (choice === 'remote' ? conflict.remote : conflict.local) as Snapshot;
  });

  const goals = result.merged.goals.map(g => {
    const conflict = result.conflicts.find(c => c.kind === 'goal' && c.key === g.id);
    if (!conflict) return g;
    const choice = resolutions.get(g.id) ?? 'local';
    return (choice === 'remote' ? conflict.remote : conflict.local) as Goal;
  });

  return { ...result.merged, snapshots, goals };
}
