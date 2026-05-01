import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, initializePreferences, UserPreferencesRecord } from '../db/database';
import { Snapshot, Goal, UserPreferences } from '../types';
import { BackupData } from '../utils/importExport';
import { generateDefaultCategories } from '../utils/defaultCategories';
import { ViewMode } from '../utils/calculations';

interface AppContextType {
  snapshots: Snapshot[];
  goals: Goal[];
  preferences: UserPreferences | null;
  currentSnapshot: Snapshot | null;
  previousSnapshot: Snapshot | null;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  saveSnapshot: (snapshot: Snapshot) => Promise<void>;
  deleteSnapshot: (id: string) => Promise<void>;
  saveGoal: (goal: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  createNewSnapshot: () => Snapshot;
  cloneLatestSnapshot: () => Snapshot;
  restoreBackup: (data: BackupData) => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overall');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      await initializePreferences();
      const [snaps, gs, prefs] = await Promise.all([
        db.snapshots.orderBy('month').toArray(),
        db.goals.toArray(),
        db.preferences.get(1),
      ]);
      setSnapshots(snaps);
      setGoals(gs);
      setPreferences(prefs ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  const saveSnapshot = async (snapshot: Snapshot) => {
    await db.snapshots.put(snapshot);
    setSnapshots(await db.snapshots.orderBy('month').toArray());
  };

  const deleteSnapshot = async (id: string) => {
    await db.snapshots.delete(id);
    setSnapshots(await db.snapshots.orderBy('month').toArray());
  };

  const saveGoal = async (goal: Goal) => {
    await db.goals.put(goal);
    setGoals(await db.goals.toArray());
  };

  const deleteGoal = async (id: string) => {
    await db.goals.delete(id);
    setGoals(await db.goals.toArray());
  };

  const updatePreferences = async (prefs: Partial<UserPreferences>) => {
    const current = await db.preferences.get(1);
    const base: UserPreferencesRecord = current ?? {
      baseCurrency: 'INR',
      enabledCurrencies: ['INR', 'USD', 'SGD', 'EUR', 'GBP'],
      theme: 'dark',
      profileName: 'User',
    };
    const updated: UserPreferencesRecord = { ...base, ...prefs, id: 1 };
    await db.preferences.put(updated);
    setPreferences(updated);
  };

  const restoreBackup = async (data: BackupData) => {
    setIsLoading(true);
    try {
      await db.transaction('rw', db.snapshots, db.goals, db.preferences, async () => {
        await db.snapshots.clear();
        await db.goals.clear();
        await db.preferences.clear();
        
        if (data.snapshots.length) await db.snapshots.bulkAdd(data.snapshots);
        if (data.goals.length) await db.goals.bulkAdd(data.goals);
        if (data.preferences) await db.preferences.put({ ...data.preferences, id: 1 });
      });
      await load();
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSnapshot = (): Snapshot => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      id: crypto.randomUUID(),
      month,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      exchangeRates: { USD: 83, SGD: 62, EUR: 90, GBP: 105, AED: 22.6, AUD: 54 },
      categories: generateDefaultCategories(),
    };
  };

  const cloneLatestSnapshot = (): Snapshot => {
    if (!currentSnapshot) return createNewSnapshot();
    const now = new Date();
    const d = new Date(currentSnapshot.month + '-01');
    d.setMonth(d.getMonth() + 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      ...currentSnapshot,
      id: crypto.randomUUID(),
      month: newMonth,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  return (
    <AppContext.Provider value={{
      snapshots,
      goals,
      preferences,
      currentSnapshot,
      previousSnapshot,
      viewMode,
      setViewMode,
      saveSnapshot,
      deleteSnapshot,
      saveGoal,
      deleteGoal,
      updatePreferences,
      createNewSnapshot,
      cloneLatestSnapshot,
      restoreBackup,
      isLoading,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
