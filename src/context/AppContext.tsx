import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, initializePreferences, UserPreferencesRecord } from '../db/database';
import { Snapshot, Goal, UserPreferences, AutoBackupRecord, CategoryTemplate } from '../types';
import { googleDriveProvider } from '../utils/cloudSync/google/drive';
import { configureClientId } from '../utils/cloudSync/google/gis';
import { recordAutoBackup, listAutoBackups, deleteAutoBackup } from '../utils/autoBackup';
import { DEFAULT_CATEGORY_TEMPLATES, buildCategoryFromTemplate } from '../utils/defaultCategories';
import { ViewMode, BackupData } from '../types';
import { useCloudSync, SyncConflictState, PullOutcome } from './useCloudSync';
import { RATE_ANCHOR } from '../utils/calculations';

export type { SyncConflictState, PullOutcome };

function normalizeRates(snap: Snapshot): Snapshot {
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(snap.exchangeRates)) {
    rates[code] = Math.round(rate * 1e5) / 1e5;
  }
  return { ...snap, exchangeRates: rates };
}

/**
 * One-time migration from old base-relative rates ("1 foreign = X base") to
 * anchor-relative rates ("1 USD = X currency"). Detected by absence of ratesAnchor.
 *
 * Migration formula (example, INR base):
 *   old { USD: 83, SGD: 62 }  →  new { INR: 83, SGD: 83/62≈1.34 }
 */
function migrateToAnchorRates(snap: Snapshot, baseCurrency: string): Snapshot {
  if (snap.ratesAnchor === RATE_ANCHOR) return snap; // already migrated

  const oldRates = snap.exchangeRates;
  const usdToBase = oldRates[RATE_ANCHOR]; // old "1 USD = usdToBase base"

  if (!usdToBase || usdToBase <= 0) {
    // Can't derive anchor rates without a USD reference — clear so MissingRateBanner fires
    return { ...snap, exchangeRates: {}, ratesAnchor: RATE_ANCHOR };
  }

  const newRates: Record<string, number> = {};
  newRates[baseCurrency] = usdToBase; // "1 USD = usdToBase baseCurrency"

  for (const [currency, oldRate] of Object.entries(oldRates)) {
    if (currency === RATE_ANCHOR || currency === baseCurrency) continue;
    if (oldRate > 0) {
      newRates[currency] = usdToBase / oldRate; // "1 USD = usdToBase/oldRate currency"
    }
  }

  return { ...snap, exchangeRates: newRates, ratesAnchor: RATE_ANCHOR };
}

function rehydrateFlags(snaps: Snapshot[], templates: CategoryTemplate[]): Snapshot[] {
  if (!templates.length) return snaps;
  const byId = new Map(templates.map(t => [t.id, t]));
  const byNameType = new Map(templates.map(t => [`${t.name}::${t.type}`, t]));
  return snaps.map(s => ({
    ...s,
    categories: s.categories.map(c => {
      const t = byId.get(c.id) ?? byNameType.get(`${c.name}::${c.type}`);
      return t ? { ...c, isLiquid: t.isLiquid, isInvestable: t.isInvestable } : c;
    }),
  }));
}

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
  pullFromCloud: () => Promise<PullOutcome>;
  syncConflicts: SyncConflictState | null;
  resolveConflicts: (resolutions: Map<string, 'local' | 'remote'>) => Promise<void>;
  dismissSyncConflicts: () => void;
  isLoading: boolean;
}

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overall');
  const [isLoading, setIsLoading] = useState(true);

  const snapshotsRef = useRef<Snapshot[]>([]);
  const goalsRef = useRef<Goal[]>([]);
  const prefsRef = useRef<UserPreferences | null>(null);

  useEffect(() => { snapshotsRef.current = snapshots; }, [snapshots]);
  useEffect(() => { goalsRef.current = goals; }, [goals]);
  useEffect(() => { prefsRef.current = preferences; }, [preferences]);

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
      setGoals(gs);

      let finalPrefs = prefs ?? null;
      if (finalPrefs && !finalPrefs.categoryTemplates) {
        const migrated = [
          ...DEFAULT_CATEGORY_TEMPLATES,
          ...(finalPrefs.customCategories ?? []).map(t => ({
            ...t,
            id: (t as { id?: string }).id ?? crypto.randomUUID(),
            isBuiltIn: false,
          })),
        ];
        finalPrefs = { ...finalPrefs, categoryTemplates: migrated };
        await db.preferences.put({ ...finalPrefs, id: 1 } as UserPreferencesRecord);
      }
      setPreferences(finalPrefs);
      const baseCurrency = finalPrefs?.baseCurrency ?? 'INR';
      const normalizedSnaps = snaps.map(s => migrateToAnchorRates(normalizeRates(s), baseCurrency));
      const toSave = normalizedSnaps.filter((s, i) => s.ratesAnchor !== snaps[i].ratesAnchor);
      if (toSave.length > 0) await db.snapshots.bulkPut(toSave);
      const rehydrated = finalPrefs?.categoryTemplates
        ? rehydrateFlags(normalizedSnaps, finalPrefs.categoryTemplates)
        : normalizedSnaps;
      setSnapshots(rehydrated);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!preferences) return;
    const root = document.documentElement;
    if (preferences.theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preferences.theme);
    }
  }, [preferences?.theme]);

  const currentSnapshot  = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  const restoreBackup = async (data: BackupData) => {
    setIsLoading(true);
    try {
      await db.transaction('rw', db.snapshots, db.goals, db.preferences, db.syncMeta, async () => {
        await db.snapshots.clear();
        await db.goals.clear();
        await db.preferences.clear();
        await db.syncMeta.clear();
        if (data.snapshots.length) await db.snapshots.bulkPut(data.snapshots);
        if (data.goals.length) await db.goals.bulkPut(data.goals);
        if (data.preferences) await db.preferences.put({ ...data.preferences, id: 1 });
      });
      await load();
    } finally {
      setIsLoading(false);
    }
  };

  const {
    syncConflicts,
    syncToCloud,
    pullFromCloud,
    resolveConflicts,
    dismissSyncConflicts,
    debouncedCloudSync,
  } = useCloudSync({ snapshotsRef, goalsRef, prefsRef, setPreferences, restoreBackup });

  // Silent pull from Drive once after initial load when a session token is available
  const hasPulledRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (hasPulledRef.current) return;
    hasPulledRef.current = true;
    const prefs = prefsRef.current;
    if (prefs?.cloudSync?.enabled && prefs.cloudSync.provider === 'google' && googleDriveProvider.isSignedIn()) {
      pullFromCloud().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const saveSnapshot = async (snapshot: Snapshot) => {
    const duplicate = snapshots.find(s => s.month === snapshot.month && s.id !== snapshot.id);
    if (duplicate) throw new Error(`duplicate_month:${snapshot.month}`);
    snapshot = { ...snapshot, updatedAt: new Date().toISOString() };
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
    setSnapshots(prev => {
      const next = prev.filter(s => s.id !== id);
      if (prefsRef.current) {
        recordAutoBackup('snapshot', next, goalsRef.current, prefsRef.current).catch(() => {});
      }
      return next;
    });
    debouncedCloudSync();
  };

  const saveGoal = async (goal: Goal) => {
    const stamped = { ...goal, updatedAt: new Date().toISOString() };
    await db.goals.put(stamped);
    setGoals(prev => {
      const idx = prev.findIndex(g => g.id === stamped.id);
      let next: Goal[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = stamped;
      } else {
        next = [...prev, stamped];
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
    setGoals(prev => {
      const next = prev.filter(g => g.id !== id);
      if (prefsRef.current) {
        recordAutoBackup('goal', snapshotsRef.current, next, prefsRef.current).catch(() => {});
      }
      return next;
    });
    debouncedCloudSync();
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
    if (prefs.categoryTemplates) {
      setSnapshots(prev => rehydrateFlags(prev, prefs.categoryTemplates!));
    }
    recordAutoBackup('preferences', snapshotsRef.current, goalsRef.current, updated).catch(() => {});
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

  const getEnabledTemplates = () =>
    (preferences?.categoryTemplates ?? DEFAULT_CATEGORY_TEMPLATES).filter(t => !t.disabled);

  const createNewSnapshot = (): Snapshot => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const categories = getEnabledTemplates().map(buildCategoryFromTemplate);
    return {
      id: crypto.randomUUID(),
      month,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      exchangeRates: currentSnapshot?.exchangeRates ?? {},
      ratesLastUpdated: currentSnapshot?.ratesLastUpdated,
      ratesAnchor: RATE_ANCHOR,
      categories,
    };
  };

  const cloneLatestSnapshot = (): Snapshot => {
    if (!currentSnapshot) return createNewSnapshot();
    const now = new Date();
    const [yearStr, monthStr] = currentSnapshot.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    const newMonth  = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

    const enabledTemplates = getEnabledTemplates();
    const existing = currentSnapshot.categories;
    const missing = enabledTemplates
      .filter(t => !existing.some(c => c.id === t.id || (c.name === t.name && c.type === t.type)))
      .map(buildCategoryFromTemplate);

    return {
      ...currentSnapshot,
      id: crypto.randomUUID(),
      month: newMonth,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      categories: missing.length > 0 ? [...existing, ...missing] : existing,
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
      pullFromCloud,
      syncConflicts,
      resolveConflicts,
      dismissSyncConflicts,
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
