import { describe, it, expect } from 'vitest';
import { mergeBackups, applyResolutions } from '../syncEngine';
import { BackupData } from '../../importExport';
import { Snapshot, Goal, UserPreferences } from '../../../types';

const PREFS: UserPreferences = {
  baseCurrency: 'INR',
  enabledCurrencies: ['INR'],
  theme: 'dark',
  profileName: 'Test',
};

function snap(month: string, updatedAt: string, netWorthMarker = 0): Snapshot {
  return {
    id: `id-${month}`,
    month,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    exchangeRates: { USD: 83 },
    categories: [
      { id: `c-${month}`, name: 'Cash', type: 'asset', icon: '💰', isLiquid: true, isInvestable: false,
        items: [{ id: `i-${month}`, name: 'Bank', amount: netWorthMarker, currency: 'INR' }] },
    ],
  };
}

function goal(id: string, updatedAt: string | undefined, targetAmount = 100): Goal {
  return {
    id, type: 'net_worth_target', name: `Goal ${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...(updatedAt ? { updatedAt } : {}),
    targetAmount,
  };
}

function backup(snapshots: Snapshot[], goals: Goal[] = []): BackupData {
  return { version: 1, exportDate: '2026-06-01T00:00:00.000Z', snapshots, goals, preferences: PREFS };
}

describe('mergeBackups — snapshots', () => {
  it('keeps unchanged records and unions new ones from both sides', () => {
    const base = backup([snap('2026-01', 't1')]);
    const local = backup([snap('2026-01', 't1'), snap('2026-02', 't2')]);
    const remote = backup([snap('2026-01', 't1'), snap('2026-03', 't3')]);
    const { merged, conflicts } = mergeBackups(base, local, remote);
    expect(conflicts).toHaveLength(0);
    expect(merged.snapshots.map(s => s.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('honors a deletion when the surviving side is unchanged vs base', () => {
    const base = backup([snap('2026-01', 't1'), snap('2026-02', 't2')]);
    const local = backup([snap('2026-01', 't1')]);            // local deleted Feb
    const remote = backup([snap('2026-01', 't1'), snap('2026-02', 't2')]); // remote unchanged
    const { merged } = mergeBackups(base, local, remote);
    expect(merged.snapshots.map(s => s.month)).toEqual(['2026-01']); // deletion respected
  });

  it('does NOT drop a remotely-edited snapshot that was deleted locally (edit wins)', () => {
    const base = backup([snap('2026-02', 't2', 0)]);
    const local = backup([]);                          // local deleted Feb
    const remote = backup([snap('2026-02', 't2-edited', 999)]); // remote edited Feb
    const { merged } = mergeBackups(base, local, remote);
    expect(merged.snapshots.map(s => s.month)).toEqual(['2026-02']);
    expect(merged.snapshots[0].categories[0].items[0].amount).toBe(999); // remote edit preserved
  });

  it('does NOT drop a locally-edited snapshot that was deleted remotely (edit wins)', () => {
    const base = backup([snap('2026-02', 't2', 0)]);
    const local = backup([snap('2026-02', 't2-edited', 555)]); // local edited Feb
    const remote = backup([]);                                 // remote deleted Feb
    const { merged } = mergeBackups(base, local, remote);
    expect(merged.snapshots.map(s => s.month)).toEqual(['2026-02']);
    expect(merged.snapshots[0].categories[0].items[0].amount).toBe(555);
  });

  it('raises a conflict when both sides edited the same month differently', () => {
    const base = backup([snap('2026-02', 't2', 0)]);
    const local = backup([snap('2026-02', 't2-local', 111)]);
    const remote = backup([snap('2026-02', 't2-remote', 222)]);
    const { conflicts } = mergeBackups(base, local, remote);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('snapshot');
    expect(conflicts[0].key).toBe('2026-02');
    expect(conflicts[0].id).toBe('snapshot:2026-02');
  });

  it('one-sided edit wins without a conflict', () => {
    const base = backup([snap('2026-02', 't2', 0)]);
    const local = backup([snap('2026-02', 't2-local', 111)]); // only local changed
    const remote = backup([snap('2026-02', 't2', 0)]);
    const { merged, conflicts } = mergeBackups(base, local, remote);
    expect(conflicts).toHaveLength(0);
    expect(merged.snapshots[0].categories[0].items[0].amount).toBe(111);
  });

  it('with no base, falls back to last-write-wins by updatedAt', () => {
    const local = backup([snap('2026-02', '2026-02-01T00:00:00.000Z', 111)]);
    const remote = backup([snap('2026-02', '2026-05-01T00:00:00.000Z', 222)]);
    const { merged, conflicts } = mergeBackups(null, local, remote);
    expect(conflicts).toHaveLength(0);
    expect(merged.snapshots[0].categories[0].items[0].amount).toBe(222); // remote newer
  });
});

describe('mergeBackups — goals', () => {
  it('edit wins over delete for goals too', () => {
    const base = backup([], [goal('g1', 't1', 100)]);
    const local = backup([], []);                          // local deleted g1
    const remote = backup([], [goal('g1', 't1-edited', 500)]); // remote edited g1
    const { merged } = mergeBackups(base, local, remote);
    expect(merged.goals.map(g => g.id)).toEqual(['g1']);
    expect(merged.goals[0].targetAmount).toBe(500);
  });

  it('raises a conflict on divergent goal edits', () => {
    const base = backup([], [goal('g1', 't1', 100)]);
    const local = backup([], [goal('g1', 't1-local', 200)]);
    const remote = backup([], [goal('g1', 't1-remote', 300)]);
    const { conflicts } = mergeBackups(base, local, remote);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe('goal:g1');
  });
});

describe('applyResolutions', () => {
  it('keeps the chosen side per conflict and never cross-applies between a goal and a same-named snapshot key', () => {
    // Construct a snapshot for month "2026-05" AND a goal whose id is "2026-05"
    const base = backup([snap('2026-05', 't1', 0)], [goal('2026-05', 't1', 100)]);
    const local = backup([snap('2026-05', 't1-local', 11)], [goal('2026-05', 't1-local', 200)]);
    const remote = backup([snap('2026-05', 't1-remote', 22)], [goal('2026-05', 't1-remote', 300)]);

    const result = mergeBackups(base, local, remote);
    expect(result.conflicts).toHaveLength(2);

    // Keep snapshot=remote, goal=local — independent choices despite identical key strings
    const resolutions = new Map<string, 'local' | 'remote'>([
      ['snapshot:2026-05', 'remote'],
      ['goal:2026-05', 'local'],
    ]);
    const final = applyResolutions(result, resolutions);
    expect(final.snapshots[0].categories[0].items[0].amount).toBe(22); // remote snapshot
    expect(final.goals[0].targetAmount).toBe(200);                      // local goal
  });

  it('defaults to local when a resolution is missing', () => {
    const base = backup([snap('2026-02', 't2', 0)]);
    const local = backup([snap('2026-02', 't2-local', 111)]);
    const remote = backup([snap('2026-02', 't2-remote', 222)]);
    const result = mergeBackups(base, local, remote);
    const final = applyResolutions(result, new Map());
    expect(final.snapshots[0].categories[0].items[0].amount).toBe(111); // local default
  });
});
