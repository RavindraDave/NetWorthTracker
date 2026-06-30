// Encryption-at-rest boundary for the financial data tables (snapshots, goals).
//
// This is the single choke point that reads/writes those tables. When the app lock is
// active (a session DEK is present) records are stored as `{ id, enc }` ciphertext;
// otherwise they pass through as plaintext, so behaviour is unchanged when the lock is off.
//
// Preferences are intentionally NOT encrypted: the boot path must read `appLock` config
// before the user unlocks, and preferences carry no monetary amounts.

import { db } from '../db/database';
import { Snapshot, Goal } from '../types';
import { getSessionDEK, encryptWithDEK, decryptWithDEK } from './cloudSync/keyVault';

interface EncRow {
  id: string;
  enc: string;
}

type Stored<T> = T | EncRow;

// A real Snapshot/Goal never carries an `enc` field, so its presence unambiguously
// marks an encrypted-at-rest row.
function isEnc(row: unknown): row is EncRow {
  return !!row && typeof (row as EncRow).enc === 'string';
}

async function decodeRow<T extends { id: string }>(row: Stored<T>, dek: string | null): Promise<T> {
  if (isEnc(row)) {
    if (!dek) throw new Error('App is locked — cannot read encrypted data without unlocking.');
    return JSON.parse(await decryptWithDEK(dek, row.enc)) as T;
  }
  return row as T;
}

async function encodeRow<T extends { id: string }>(row: T, dek: string | null): Promise<Stored<T>> {
  if (!dek) return row; // lock disabled → plaintext passthrough
  return { id: row.id, enc: await encryptWithDEK(dek, JSON.stringify(row)) };
}

// ── Reads ─────────────────────────────────────────────────────────────────────
export async function readSnapshots(): Promise<Snapshot[]> {
  const dek = getSessionDEK();
  const rows = (await db.snapshots.toArray()) as unknown as Stored<Snapshot>[];
  return Promise.all(rows.map(r => decodeRow<Snapshot>(r, dek)));
}

export async function readGoals(): Promise<Goal[]> {
  const dek = getSessionDEK();
  const rows = (await db.goals.toArray()) as unknown as Stored<Goal>[];
  return Promise.all(rows.map(r => decodeRow<Goal>(r, dek)));
}

// ── Encoders (for callers that batch their own transactions, e.g. restoreBackup) ──
export async function encodeSnapshots(snaps: Snapshot[]): Promise<unknown[]> {
  const dek = getSessionDEK();
  return Promise.all(snaps.map(s => encodeRow(s, dek)));
}

export async function encodeGoals(goals: Goal[]): Promise<unknown[]> {
  const dek = getSessionDEK();
  return Promise.all(goals.map(g => encodeRow(g, dek)));
}

// ── Writes ──────────────────────────────────────────────────────────────────
export async function putSnapshot(snapshot: Snapshot): Promise<void> {
  const dek = getSessionDEK();
  await db.snapshots.put((await encodeRow(snapshot, dek)) as unknown as Snapshot);
}

export async function putGoal(goal: Goal): Promise<void> {
  const dek = getSessionDEK();
  await db.goals.put((await encodeRow(goal, dek)) as unknown as Goal);
}

export async function bulkPutSnapshots(snaps: Snapshot[]): Promise<void> {
  if (!snaps.length) return;
  const encoded = await encodeSnapshots(snaps);
  await db.snapshots.bulkPut(encoded as unknown as Snapshot[]);
}

// ── Migration: encrypt / decrypt every row when the lock is toggled ───────────
/** Encrypt all currently-plaintext snapshot/goal rows with `dek`. Idempotent. */
export async function encryptAllAtRest(dek: string): Promise<void> {
  const snaps = (await db.snapshots.toArray()) as unknown as Stored<Snapshot>[];
  const goals = (await db.goals.toArray()) as unknown as Stored<Goal>[];
  const encSnaps = await Promise.all(snaps.map(async s => (isEnc(s) ? s : encodeRow(await decodeRow<Snapshot>(s, dek), dek))));
  const encGoals = await Promise.all(goals.map(async g => (isEnc(g) ? g : encodeRow(await decodeRow<Goal>(g, dek), dek))));
  await db.transaction('rw', db.snapshots, db.goals, async () => {
    await db.snapshots.bulkPut(encSnaps as unknown as Snapshot[]);
    await db.goals.bulkPut(encGoals as unknown as Goal[]);
  });
}

// ── Sync-meta base (three-way-merge base state) at-rest ───────────────────────
// `syncMeta.base` holds a full BackupData JSON. Encrypt it too so amounts don't leak.
function syncMetaLooksEncrypted(base: string): boolean {
  try {
    const o = JSON.parse(base) as { iv?: unknown; ct?: unknown; snapshots?: unknown };
    return typeof o.iv === 'string' && typeof o.ct === 'string' && o.snapshots === undefined;
  } catch {
    return false;
  }
}

/** Encrypt `syncMeta.base` (a plaintext BackupData JSON) when storing under the lock. */
export async function encodeSyncMetaBase(base: string): Promise<string> {
  const dek = getSessionDEK();
  return dek ? encryptWithDEK(dek, base) : base;
}

/** Decrypt `syncMeta.base` back to a plaintext BackupData JSON. */
export async function decodeSyncMetaBase(base: string): Promise<string> {
  const dek = getSessionDEK();
  return dek && syncMetaLooksEncrypted(base) ? decryptWithDEK(dek, base) : base;
}

export async function encryptSyncMetaAtRest(dek: string): Promise<void> {
  const rec = await db.syncMeta.get(1);
  if (rec && !syncMetaLooksEncrypted(rec.base)) {
    await db.syncMeta.put({ ...rec, base: await encryptWithDEK(dek, rec.base) });
  }
}

export async function decryptSyncMetaAtRest(dek: string): Promise<void> {
  const rec = await db.syncMeta.get(1);
  if (rec && syncMetaLooksEncrypted(rec.base)) {
    await db.syncMeta.put({ ...rec, base: await decryptWithDEK(dek, rec.base) });
  }
}

/** Decrypt all rows back to plaintext using `dek`. Idempotent. */
export async function decryptAllAtRest(dek: string): Promise<void> {
  const snapRows = (await db.snapshots.toArray()) as unknown as Stored<Snapshot>[];
  const goalRows = (await db.goals.toArray()) as unknown as Stored<Goal>[];
  const snaps = await Promise.all(snapRows.map(r => decodeRow<Snapshot>(r, dek)));
  const goals = await Promise.all(goalRows.map(r => decodeRow<Goal>(r, dek)));
  await db.transaction('rw', db.snapshots, db.goals, async () => {
    await db.snapshots.bulkPut(snaps);
    await db.goals.bulkPut(goals);
  });
}
