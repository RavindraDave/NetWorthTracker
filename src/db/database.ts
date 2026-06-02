import Dexie, { type Table } from 'dexie';
import { Snapshot, Goal, UserPreferences, AutoBackupRecord } from '../types';

export interface UserPreferencesRecord extends UserPreferences {
  id?: number;
}

export interface FileHandleRecord {
  id: string;
  handle: FileSystemDirectoryHandle;
}

// Base state for three-way merge — the last data that was successfully synced to Drive
export interface SyncMetaRecord {
  id: 1;
  updatedISO: string;
  base: string; // JSON-serialized BackupData (plaintext)
}

export class WealthPulseDB extends Dexie {
  snapshots!: Table<Snapshot, string>;
  goals!: Table<Goal, string>;
  preferences!: Table<UserPreferencesRecord, number>;
  autoBackups!: Table<AutoBackupRecord, number>;
  fileHandles!: Table<FileHandleRecord, string>;
  syncMeta!: Table<SyncMetaRecord, number>;

  constructor() {
    super('WealthPulseDB');

    this.version(1).stores({
      snapshots: 'id, month, createdAt',
      goals: 'id, type',
      preferences: '++id',
    });

    this.version(2).stores({
      snapshots: 'id, month, createdAt',
      goals: 'id, type',
      preferences: '++id',
      autoBackups: '++id, createdAt',
    });

    this.version(3).stores({
      snapshots: 'id, month, createdAt',
      goals: 'id, type',
      preferences: '++id',
      autoBackups: '++id, createdAt',
      fileHandles: 'id',
    });

    this.version(4).stores({
      snapshots: 'id, month, createdAt',
      goals: 'id, type',
      preferences: '++id',
      autoBackups: '++id, createdAt',
      fileHandles: 'id',
      syncMeta: 'id',
    });
  }
}

export const db = new WealthPulseDB();

export async function initializePreferences() {
  const count = await db.preferences.count();
  if (count === 0) {
    await db.preferences.add({
      baseCurrency: 'INR',
      enabledCurrencies: ['INR', 'USD', 'SGD', 'EUR', 'GBP'],
      theme: 'dark' as 'dark' | 'light' | 'system',
      profileName: 'User',
    });
  }
}
