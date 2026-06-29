import { db } from '../db/database';
import { AutoBackupRecord, Snapshot, Goal, UserPreferences, BackupCadence } from '../types';

const MAX_BACKUPS = 90;

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
  await db.autoBackups.add(record);

  const count = await db.autoBackups.count();
  if (count > MAX_BACKUPS) {
    const oldest = await db.autoBackups.orderBy('createdAt').first();
    if (oldest?.id != null) await db.autoBackups.delete(oldest.id);
  }
}

export async function listAutoBackups(): Promise<AutoBackupRecord[]> {
  return db.autoBackups.orderBy('createdAt').reverse().toArray();
}

export async function deleteAutoBackup(id: number): Promise<void> {
  return db.autoBackups.delete(id);
}
