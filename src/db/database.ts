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
  // Drive `version` of the canonical sync file that this base was reconciled against.
  // Used for optimistic-concurrency: a push is refused if the remote advanced past it.
  baseVersion?: number;
}

// App-lock key vault. Stores the DEK wrapped by each unlock method ("slot"); never the
// DEK or any passphrase in plaintext. See `src/utils/cloudSync/keyVault.ts`.
export type WrappedKeyEnvelope = string;
export interface KeyVaultRecord {
  id: 1;
  v: 1;
  slots: {
    passphrase?: WrappedKeyEnvelope;
    recoveryCode?: WrappedKeyEnvelope;
    googleEscrow?: WrappedKeyEnvelope; // sentinel marker; the recoverable copy lives in Drive
    webauthn?: { wrapped: WrappedKeyEnvelope; credentialId: string };
  };
  verifier: string; // a known plaintext encrypted by the DEK → confirms a correct unlock
  createdISO: string;
}

export class WealthPulseDB extends Dexie {
  snapshots!: Table<Snapshot, string>;
  goals!: Table<Goal, string>;
  preferences!: Table<UserPreferencesRecord, number>;
  autoBackups!: Table<AutoBackupRecord, number>;
  fileHandles!: Table<FileHandleRecord, string>;
  syncMeta!: Table<SyncMetaRecord, number>;
  keyVault!: Table<KeyVaultRecord, number>;

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

    this.version(5).stores({
      snapshots: 'id, month, createdAt',
      goals: 'id, type',
      preferences: '++id',
      autoBackups: '++id, createdAt',
      fileHandles: 'id',
      syncMeta: 'id',
      keyVault: 'id',
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
