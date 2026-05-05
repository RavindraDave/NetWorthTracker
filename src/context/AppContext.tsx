import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, initializePreferences, UserPreferencesRecord } from '../db/database';
import { Snapshot, Goal, UserPreferences, AutoBackupRecord } from '../types';
import { googleDriveProvider } from '../utils/cloudSync/google/drive';
import { configureClientId } from '../utils/cloudSync/google/gis';

function normalizeRates(snap: Snapshot): Snapshot {
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(snap.exchangeRates)) {
    rates[code] = Math.round(rate * 1e5) / 1e5;
  }
  return { ...snap, exchangeRates: rates };
}
import { BackupData, exportToJSON } from '../utils/importExport';
import { recordAutoBackup, listAutoBackups, deleteAutoBackup } from '../utils/autoBackup';
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
  restoreAutoBackup: (record: AutoBackupRecord) => Promise<void>;
  listAutoBackups: () => Promise<AutoBackupRecord[]>;
  deleteAutoBackup: (id: number) => Promise<void>;
  manualBackup: () => Promise<void>;
  syncToCloud: () => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overall');
  const [isLoading, setIsLoading] = useState(true);

  // Refs so backup callbacks always see latest state without stale closures
  const snapshotsRef = useRef<Snapshot[]>([]);
  const goalsRef = useRef<Goal[]>([]);
  const prefsRef = useRef<UserPreferences | null>(null);
  const cloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { snapshotsRef.current = snapshots; }, [snapshots]);
  useEffect(() => { goalsRef.current = goals; }, [goals]);
  useEffect(() => { prefsRef.current = preferences; }, [preferences]);

  // Keep GIS client ID in sync with whatever is stored in preferences
  useEffect(() => {
    if (preferences?.cloudSync?.clientId) {
      configureClientId(preferences.cloudSync.clientId);
    }
  }, [preferences?.cloudSync?.clientId]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      await initializePreferences();
      const [snaps, gs, prefs] = await Promise.all([
        db.snapshots.orderBy('month').toArray(),
        db.goals.toArray(),
        db.preferences.get(1),
      ]);
      setSnapshots(snaps.map(normalizeRates));
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
    const duplicate = snapshots.find(s => s.month === snapshot.month && s.id !== snapshot.id);
    if (duplicate) throw new Error(`duplicate_month:${snapshot.month}`);
    await db.snapshots.put(snapshot);
    setSnapshots(prev => {
      const idx = prev.findIndex(s => s.id === snapshot.id);
      let next: Snapshot[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = snapshot;
      } else {
        next = [...prev, snapshot].sort((a, b) => a.month.localeCompare(b.month));
      }
      if (prefsRef.current) {
        recordAutoBackup('snapshot', next, goalsRef.current, prefsRef.current).catch(() => {});
      }
      return next;
    });
    debouncedCloudSync();
  };

  const deleteSnapshot = async (id: string) => {
    await db.snapshots.delete(id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
  };

  const saveGoal = async (goal: Goal) => {
    await db.goals.put(goal);
    setGoals(prev => {
      const idx = prev.findIndex(g => g.id === goal.id);
      let next: Goal[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = goal;
      } else {
        next = [...prev, goal];
      }
      if (prefsRef.current) {
        recordAutoBackup('goal', snapshotsRef.current, next, prefsRef.current).catch(() => {});
      }
      return next;
    });
    debouncedCloudSync();
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
    recordAutoBackup('preferences', snapshotsRef.current, goalsRef.current, updated).catch(() => {});
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

  const restoreAutoBackup = async (record: AutoBackupRecord) => {
    const data: BackupData = {
      version: 1,
      exportDate: record.createdAt,
      snapshots: record.snapshots,
      goals: record.goals,
      preferences: record.preferences,
    };
    await restoreBackup(data);
  };

  const manualBackup = async () => {
    if (!preferences) return;
    await recordAutoBackup('manual', snapshots, goals, preferences);
  };

  const syncToCloud = async () => {
    const prefs = prefsRef.current;
    if (!prefs?.cloudSync?.enabled || prefs.cloudSync.provider !== 'google') return;
    const snaps = snapshotsRef.current;
    const gs = goalsRef.current;
    if (snaps.length === 0) return;
    const date = new Date().toISOString().split('T')[0];
    const filename = `wealthpulse-backup-${date}.json`;
    const json = exportToJSON(snaps, gs, prefs);
    try {
      await googleDriveProvider.upload(json, filename);
      const updated = { ...prefs.cloudSync, lastSyncISO: new Date().toISOString(), lastError: undefined };
      await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
      setPreferences(p => p ? { ...p, cloudSync: updated } : p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cloud sync failed';
      const updated = { ...prefs.cloudSync, lastError: msg };
      await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
      setPreferences(p => p ? { ...p, cloudSync: updated } : p);
    }
  };

  const debouncedCloudSync = () => {
    if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = setTimeout(() => { syncToCloud().catch(() => {}); }, 5000);
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
      restoreAutoBackup,
      listAutoBackups,
      deleteAutoBackup,
      manualBackup,
      syncToCloud,
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
