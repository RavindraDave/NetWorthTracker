import { db } from '../db/database';
import { AutoBackupRecord, Snapshot, Goal, UserPreferences } from '../types';

const MAX_BACKUPS = 30;

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
