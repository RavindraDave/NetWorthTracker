import Dexie, { type Table } from 'dexie';
import { Snapshot, Goal, UserPreferences } from '../types';

// DB-layer model — adds the auto-increment PK that Dexie manages
export interface UserPreferencesRecord extends UserPreferences {
  id?: number;
}

export class WealthPulseDB extends Dexie {
  snapshots!: Table<Snapshot, string>;
  goals!: Table<Goal, string>;
  preferences!: Table<UserPreferencesRecord, number>;

  constructor() {
    super('WealthPulseDB');

    this.version(1).stores({
      snapshots: 'id, month, createdAt',
      goals: 'id, type',
      preferences: '++id', // Singleton with id=1
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
      theme: 'dark',
      profileName: 'User',
    });
  }
}
