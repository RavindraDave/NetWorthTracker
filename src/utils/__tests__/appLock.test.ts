// fake-indexeddb must load before the Dexie `db` singleton is imported.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/database';
import {
  enableAppLock, disableAppLock, changeAppLockPassphrase,
  unlockWithPassphrase, addRecoveryCode, recoverWithCode, removeRecoveryCode,
} from '../appLock';
import { setSessionDEK, getSessionDEK, lockSession } from '../cloudSync/keyVault';
import { readSnapshots } from '../secureStore';
import type { Snapshot } from '../../types';

function snap(month: string): Snapshot {
  return {
    id: `id-${month}`, month,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    exchangeRates: { USD: 83 }, categories: [],
  };
}

describe('app lock lifecycle', () => {
  beforeEach(async () => {
    lockSession();
    await db.snapshots.clear();
    await db.goals.clear();
    await db.keyVault.clear();
    await db.snapshots.put(snap('2026-01'));
  });

  it('enables the lock and encrypts existing data at rest', async () => {
    await enableAppLock('my-passphrase');
    expect(getSessionDEK()).toBeTypeOf('string');
    const vault = await db.keyVault.get(1);
    expect(vault?.slots.passphrase).toBeTypeOf('string');
    const raw = (await db.snapshots.toArray())[0] as { enc?: string };
    expect(raw.enc).toBeTypeOf('string');
  });

  it('unlocks with the right passphrase and rejects a wrong one', async () => {
    await enableAppLock('my-passphrase');
    lockSession(); // simulate a fresh session / reload

    expect(await unlockWithPassphrase('nope')).toBeNull();
    const dek = await unlockWithPassphrase('my-passphrase');
    expect(dek).toBeTypeOf('string');

    setSessionDEK(dek!);
    expect((await readSnapshots())[0].month).toBe('2026-01');
  });

  it('recovers with a recovery code when the passphrase is forgotten', async () => {
    await enableAppLock('original');
    const code = await addRecoveryCode();
    expect(code).toMatch(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$/);
    lockSession();

    expect(await recoverWithCode('WRONG-CODE-HERE-XXXXX-YYYYY')).toBeNull();
    const dek = await recoverWithCode(code);
    expect(dek).toBeTypeOf('string');
  });

  it('removes a recovery code so it no longer works', async () => {
    await enableAppLock('original');
    const code = await addRecoveryCode();
    await removeRecoveryCode();
    expect(await recoverWithCode(code)).toBeNull();
  });

  it('changes the passphrase: old fails, new works', async () => {
    await enableAppLock('old-pass');
    await changeAppLockPassphrase('new-pass');
    lockSession();
    expect(await unlockWithPassphrase('old-pass')).toBeNull();
    expect(await unlockWithPassphrase('new-pass')).toBeTypeOf('string');
  });

  it('disables the lock and restores plaintext', async () => {
    await enableAppLock('my-passphrase');
    await disableAppLock();
    expect(getSessionDEK()).toBeNull();
    expect(await db.keyVault.get(1)).toBeUndefined();
    const raw = (await db.snapshots.toArray())[0] as { enc?: string; month?: string };
    expect(raw.enc).toBeUndefined();
    expect(raw.month).toBe('2026-01');
  });
});
