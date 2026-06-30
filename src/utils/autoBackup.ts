import { db } from '../db/database';
import { AutoBackupRecord, Snapshot, Goal, UserPreferences, BackupCadence } from '../types';
import { getSessionDEK, encryptWithDEK, decryptWithDEK } from './cloudSync/keyVault';

const MAX_BACKUPS = 90;

interface BackupPayload {
  snapshots: Snapshot[];
  goals: Goal[];
  preferences: UserPreferences;
}

// When the app lock is active, encrypt the recovery point's payload at rest.
async function encodeRecord(record: AutoBackupRecord): Promise<AutoBackupRecord> {
  const dek = getSessionDEK();
  if (!dek) return record;
  const payload: BackupPayload = { snapshots: record.snapshots, goals: record.goals, preferences: record.preferences };
  const enc = await encryptWithDEK(dek, JSON.stringify(payload));
  return { ...record, snapshots: [], goals: [], preferences: record.preferences, enc };
}

async function decodeRecord(record: AutoBackupRecord): Promise<AutoBackupRecord> {
  if (!record.enc) return record;
  const dek = getSessionDEK();
  if (!dek) throw new Error('App is locked — cannot read encrypted recovery point.');
  const payload = JSON.parse(await decryptWithDEK(dek, record.enc)) as BackupPayload;
  return { ...record, ...payload, enc: undefined };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days elapsed since an ISO timestamp. Returns Infinity when the
 * timestamp is missing (i.e. "never backed up" — always considered stale).
 * Single source of truth for "days since last backup" used by the stale-backup
 * banner and the auto-backup scheduler.
 */
export function daysSinceISO(iso: string | undefined): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY);
}

/**
 * Stale-backup threshold (in days) tuned to the user's chosen backup cadence:
 * frequent cadences nag sooner, infrequent/off keeps the long default.
 */
export function staleThresholdDays(cadence: BackupCadence | undefined): number {
  switch (cadence) {
    case 'daily':   return 3;
    case 'weekly':  return 10;
    case 'monthly': return 35;
    default:        return 30; // 'off' or unset
  }
}

export async function recordAutoBackup(
  trigger: AutoBackupRecord['trigger'],
  snapshots: Snapshot[],
  goals: Goal[],
  preferences: UserPreferences
): Promise<void> {
  const record: AutoBackupRecord = {
    createdAt: new Date().toISOString(),
    trigger,
    snapshots,
    goals,
    preferences,
  };
  await db.autoBackups.add(await encodeRecord(record));

  const count = await db.autoBackups.count();
  if (count > MAX_BACKUPS) {
    const oldest = await db.autoBackups.orderBy('createdAt').first();
    if (oldest?.id != null) await db.autoBackups.delete(oldest.id);
  }
}

export async function listAutoBackups(): Promise<AutoBackupRecord[]> {
  const records = await db.autoBackups.orderBy('createdAt').reverse().toArray();
  return Promise.all(records.map(decodeRecord));
}

export async function deleteAutoBackup(id: number): Promise<void> {
  return db.autoBackups.delete(id);
}

/** Encrypt every currently-plaintext recovery point with `dek` (lock enable migration). */
export async function encryptAllAutoBackups(dek: string): Promise<void> {
  const records = await db.autoBackups.toArray();
  for (const r of records) {
    if (r.enc) continue;
    const payload: BackupPayload = { snapshots: r.snapshots, goals: r.goals, preferences: r.preferences };
    await db.autoBackups.put({ ...r, snapshots: [], goals: [], enc: await encryptWithDEK(dek, JSON.stringify(payload)) });
  }
}

/** Decrypt every recovery point back to plaintext with `dek` (lock disable migration). */
export async function decryptAllAutoBackups(dek: string): Promise<void> {
  const records = await db.autoBackups.toArray();
  for (const r of records) {
    if (!r.enc) continue;
    const payload = JSON.parse(await decryptWithDEK(dek, r.enc)) as BackupPayload;
    await db.autoBackups.put({ ...r, ...payload, enc: undefined });
  }
}
