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

  // Apply theme to <html> so CSS selectors can use [data-theme]
  useEffect(() => {
    if (!preferences) return;
    const root = document.documentElement;
    if (preferences.theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preferences.theme);
    }
  }, [preferences?.theme]);

  const currentSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  const saveSnapshot = async (snapshot: Snapshot) => {
    await db.snapshots.put(snapshot);
    setSnapshots(prev => {
      const idx = prev.findIndex(s => s.id === snapshot.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = snapshot;
        return updated;
      }
      return [...prev, snapshot].sort((a, b) => a.month.localeCompare(b.month));
    });
  };

  const deleteSnapshot = async (id: string) => {
    await db.snapshots.delete(id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
  };

  const saveGoal = async (goal: Goal) => {
    await db.goals.put(goal);
    setGoals(prev => {
      const idx = prev.findIndex(g => g.id === goal.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = goal;
        return updated;
      }
      return [...prev, goal];
    });
  };

  const deleteGoal = async (id: string) => {
    await db.goals.delete(id);
    setGoals(prev => prev.filter(g => g.id !== id));
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
    const defaultCats = generateDefaultCategories();
    const customCats = (preferences?.customCategories ?? []).map(t => ({
      ...t,
      id: crypto.randomUUID(),
      items: [],
    }));
    return {
      id: crypto.randomUUID(),
      month,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      exchangeRates: { USD: 83, SGD: 62, EUR: 90, GBP: 105, AED: 22.6, AUD: 54 },
      categories: [...defaultCats, ...customCats],
    };
  };

  const cloneLatestSnapshot = (): Snapshot => {
    if (!currentSnapshot) return createNewSnapshot();
    const now = new Date();
    const [yearStr, monthStr] = currentSnapshot.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const newMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
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
