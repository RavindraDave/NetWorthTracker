// fake-indexeddb must load before the Dexie `db` singleton is imported.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/database';
import {
  readSnapshots, readGoals, putSnapshot, putGoal,
  encryptAllAtRest, decryptAllAtRest,
  encodeSyncMetaBase, decodeSyncMetaBase,
} from '../secureStore';
import { generateDEK, setSessionDEK, lockSession } from '../cloudSync/keyVault';
import type { Snapshot, Goal } from '../../types';

function snap(month: string): Snapshot {
  return {
    id: `id-${month}`,
    month,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exchangeRates: { USD: 83 },
    categories: [{ id: 'c1', name: 'Cash', type: 'asset', amount: 999999, currency: 'USD' } as never],
  };
}
function goal(id: string): Goal {
  return { id, type: 'fire', name: 'FIRE', createdAt: new Date().toISOString(), targetAmount: 1000 } as Goal;
}

describe('secureStore at-rest encryption', () => {
  beforeEach(async () => {
    lockSession();
    await db.snapshots.clear();
    await db.goals.clear();
  });

  it('stores plaintext when no DEK is set (lock off)', async () => {
    await putSnapshot(snap('2026-01'));
    const raw = await db.snapshots.toArray();
    expect((raw[0] as { enc?: string }).enc).toBeUndefined();
    expect((raw[0] as Snapshot).month).toBe('2026-01');
    expect(await readSnapshots()).toHaveLength(1);
  });

  it('stores ciphertext when a DEK is set (lock on) and reads it back', async () => {
    const dek = generateDEK();
    setSessionDEK(dek);
    await putSnapshot(snap('2026-02'));
    await putGoal(goal('g1'));

    const rawSnap = (await db.snapshots.toArray())[0] as { id: string; enc?: string; month?: string };
    expect(rawSnap.enc).toBeTypeOf('string');
    expect(rawSnap.month).toBeUndefined();              // real fields are gone at rest
    expect(JSON.stringify(rawSnap)).not.toContain('999999'); // amount not leaked

    const snaps = await readSnapshots();
    expect(snaps[0].month).toBe('2026-02');
    expect((await readGoals())[0].id).toBe('g1');
  });

  it('migrates all rows on enable and back on disable', async () => {
    await putSnapshot(snap('2026-03')); // plaintext (lock off)
    const dek = generateDEK();

    setSessionDEK(dek);
    await encryptAllAtRest(dek);
    expect(((await db.snapshots.toArray())[0] as { enc?: string }).enc).toBeTypeOf('string');
    expect((await readSnapshots())[0].month).toBe('2026-03');

    await decryptAllAtRest(dek);
    lockSession();
    const raw = (await db.snapshots.toArray())[0] as { enc?: string; month?: string };
    expect(raw.enc).toBeUndefined();
    expect(raw.month).toBe('2026-03'); // readable again with lock off
  });

  it('encrypts the sync-meta base only when locked', async () => {
    const base = JSON.stringify({ version: 1, snapshots: [{ amount: 555555 }] });

    // Lock off → passthrough
    expect(await encodeSyncMetaBase(base)).toBe(base);

    // Lock on → opaque, but round-trips
    setSessionDEK(generateDEK());
    const enc = await encodeSyncMetaBase(base);
    expect(enc).not.toContain('555555');
    expect(await decodeSyncMetaBase(enc)).toBe(base);
  });
});
