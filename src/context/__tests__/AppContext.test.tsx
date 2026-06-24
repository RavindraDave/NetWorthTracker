// fake-indexeddb must be imported before anything pulls in the Dexie `db` singleton.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../AppContext';
import { db } from '../../db/database';
import type { Snapshot, Goal, UserPreferences, BackupData } from '../../types';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSnapshot(month: string, id: string = crypto.randomUUID()): Snapshot {
  return {
    id,
    month,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exchangeRates: { USD: 83 },
    categories: [],
  };
}

function makeGoal(name: string, id: string = crypto.randomUUID()): Goal {
  return { id, type: 'fire', name, createdAt: new Date().toISOString(), targetAmount: 0 };
}

const basePrefs: UserPreferences = {
  baseCurrency: 'INR',
  enabledCurrencies: ['INR', 'USD'],
  theme: 'dark',
  profileName: 'Test',
};

const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;

async function renderApp() {
  const view = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
}

// ── Reset DB between tests ──────────────────────────────────────────────────

beforeEach(async () => {
  await Promise.all([
    db.snapshots.clear(),
    db.goals.clear(),
    db.preferences.clear(),
    db.autoBackups.clear(),
    db.syncMeta.clear(),
  ]);
  // The preferences table is auto-increment (++id); clear() does not reset the key
  // counter, so a fresh add would not land on id 1. Seed id 1 explicitly so the
  // provider's load() (which reads preferences.get(1)) sees a valid record.
  await db.preferences.put({ ...basePrefs, id: 1 });
});

describe('AppContext — saveSnapshot', () => {
  it('persists a snapshot to state and IndexedDB', async () => {
    const { result } = await renderApp();
    const snap = makeSnapshot('2026-01');
    await act(async () => { await result.current.saveSnapshot(snap); });

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0].id).toBe(snap.id);
    expect(await db.snapshots.get(snap.id)).toBeTruthy();
  });

  it('stamps updatedAt on save', async () => {
    const { result } = await renderApp();
    const snap = makeSnapshot('2026-01');
    snap.updatedAt = '';
    await act(async () => { await result.current.saveSnapshot(snap); });
    expect(result.current.snapshots[0].updatedAt).not.toBe('');
  });

  it('rejects a duplicate month with a different id', async () => {
    const { result } = await renderApp();
    await act(async () => { await result.current.saveSnapshot(makeSnapshot('2026-01')); });
    await act(async () => {
      await expect(result.current.saveSnapshot(makeSnapshot('2026-01'))).rejects.toThrow(/duplicate_month:2026-01/);
    });
    expect(result.current.snapshots).toHaveLength(1);
  });

  it('updates an existing snapshot in place (same id)', async () => {
    const { result } = await renderApp();
    const snap = makeSnapshot('2026-01');
    await act(async () => { await result.current.saveSnapshot(snap); });
    await act(async () => { await result.current.saveSnapshot({ ...snap, notes: 'edited' }); });
    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0].notes).toBe('edited');
  });
});

describe('AppContext — deleteSnapshot propagation', () => {
  it('removes the snapshot from state and IndexedDB', async () => {
    const { result } = await renderApp();
    const snap = makeSnapshot('2026-01');
    await act(async () => { await result.current.saveSnapshot(snap); });
    await act(async () => { await result.current.deleteSnapshot(snap.id); });

    expect(result.current.snapshots).toHaveLength(0);
    expect(await db.snapshots.get(snap.id)).toBeUndefined();
  });

  it('records an auto-backup reflecting the deletion (not a resurrecting stale one)', async () => {
    const { result } = await renderApp();
    const snap = makeSnapshot('2026-01');
    await act(async () => { await result.current.saveSnapshot(snap); });
    await act(async () => { await result.current.deleteSnapshot(snap.id); });

    // The fix: delete must record a post-delete auto-backup so restore can't resurrect.
    await waitFor(async () => {
      const backups = await db.autoBackups.toArray();
      expect(backups.some(b => b.trigger === 'snapshot' && b.snapshots.length === 0)).toBe(true);
    });
  });
});

describe('AppContext — goals', () => {
  it('saves and deletes a goal, recording a post-delete auto-backup', async () => {
    const { result } = await renderApp();
    const goal = makeGoal('Lean FIRE');
    await act(async () => { await result.current.saveGoal(goal); });
    expect(result.current.goals).toHaveLength(1);

    await act(async () => { await result.current.deleteGoal(goal.id); });
    expect(result.current.goals).toHaveLength(0);
    expect(await db.goals.get(goal.id)).toBeUndefined();

    await waitFor(async () => {
      const backups = await db.autoBackups.toArray();
      expect(backups.some(b => b.trigger === 'goal' && b.goals.length === 0)).toBe(true);
    });
  });
});

describe('AppContext — restoreBackup', () => {
  it('replaces all data with the backup contents', async () => {
    const { result } = await renderApp();
    await act(async () => { await result.current.saveSnapshot(makeSnapshot('2026-01')); });

    const data: BackupData = {
      version: 1,
      exportDate: new Date().toISOString(),
      snapshots: [makeSnapshot('2025-06'), makeSnapshot('2025-07')],
      goals: [makeGoal('Restored Goal')],
      preferences: basePrefs,
    };
    await act(async () => { await result.current.restoreBackup(data); });

    expect(result.current.snapshots).toHaveLength(2);
    expect(result.current.goals).toHaveLength(1);
    expect(result.current.snapshots.map(s => s.month)).toEqual(['2025-06', '2025-07']);
  });

  it('tolerates duplicate ids in a backup instead of aborting (bulkPut)', async () => {
    const { result } = await renderApp();
    const data: BackupData = {
      version: 1,
      exportDate: new Date().toISOString(),
      snapshots: [makeSnapshot('2026-01', 'dup'), makeSnapshot('2026-02', 'dup')],
      goals: [],
      preferences: basePrefs,
    };
    // Must not throw (bulkAdd would have rejected on the duplicate key).
    await act(async () => { await result.current.restoreBackup(data); });

    // Last write wins → a single record survives.
    expect(result.current.snapshots).toHaveLength(1);
    expect(await db.snapshots.count()).toBe(1);
  });

  it('clears syncMeta so a stale merge base cannot drop records after restore', async () => {
    const { result } = await renderApp();
    await db.syncMeta.put({ id: 1, updatedISO: new Date().toISOString(), base: '{}' });
    const data: BackupData = {
      version: 1, exportDate: new Date().toISOString(),
      snapshots: [makeSnapshot('2026-03')], goals: [], preferences: basePrefs,
    };
    await act(async () => { await result.current.restoreBackup(data); });
    expect(await db.syncMeta.get(1)).toBeUndefined();
  });
});

describe('AppContext — syncToCloud no-op when disabled', () => {
  it('resolves without error when cloud sync is not configured', async () => {
    const { result } = await renderApp();
    await act(async () => { await result.current.saveSnapshot(makeSnapshot('2026-01')); });
    await act(async () => { await expect(result.current.syncToCloud()).resolves.toBeUndefined(); });
  });

  it('pullFromCloud returns "noop" when cloud sync is not configured', async () => {
    const { result } = await renderApp();
    let outcome: string | undefined;
    await act(async () => { outcome = await result.current.pullFromCloud(); });
    expect(outcome).toBe('noop');
  });
});
