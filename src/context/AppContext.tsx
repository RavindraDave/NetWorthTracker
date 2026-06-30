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
import { migrateToAnchorRates } from '../utils/ratesMigration';
import * as secureStore from '../utils/secureStore';
import * as appLock from '../utils/appLock';
import { getSessionDEK, setSessionDEK, lockSession } from '../utils/cloudSync/keyVault';
import { setPassphrase } from '../utils/cloudSync/encryption';

export type { SyncConflictState, PullOutcome };

function normalizeRates(snap: Snapshot): Snapshot {
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(snap.exchangeRates)) {
    rates[code] = Math.round(rate * 1e5) / 1e5;
  }
  return { ...snap, exchangeRates: rates };
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
  // ── App lock ──
  isLocked: boolean;
  unlockWithPassphrase: (passphrase: string) => Promise<boolean>;
  unlockWithDEK: (dek: string) => Promise<void>;
  lockNow: () => void;
  enableAppLock: (passphrase: string) => Promise<void>;
  disableAppLock: () => Promise<void>;
  changeAppLockPassphrase: (newPassphrase: string) => Promise<void>;
  setRecoveryCode: (enabled: boolean) => Promise<string | null>;
  setGoogleEscrow: (enabled: boolean) => Promise<void>;
  setPasskey: (enabled: boolean) => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overall');
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

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
      // Read preferences first: they hold the appLock config and stay plaintext, so we can
      // decide whether to gate before any sensitive data is read into memory.
      const prefs = await db.preferences.get(1);

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

      // Gate: lock is enabled but no DEK in session → show the lock screen and load nothing.
      if (finalPrefs?.appLock?.enabled && !getSessionDEK()) {
        setSnapshots([]);
        setGoals([]);
        setIsLocked(true);
        return;
      }
      setIsLocked(false);

      const [snaps, gs] = await Promise.all([
        secureStore.readSnapshots(),
        secureStore.readGoals(),
      ]);
      setGoals(gs);

      const baseCurrency = finalPrefs?.baseCurrency ?? 'INR';
      const sorted = [...snaps].sort((a, b) => a.month.localeCompare(b.month));
      const normalizedSnaps = sorted.map(s => migrateToAnchorRates(normalizeRates(s), baseCurrency));
      const toSave = normalizedSnaps.filter((s, i) => s.ratesAnchor !== sorted[i].ratesAnchor);
      if (toSave.length > 0) await secureStore.bulkPutSnapshots(toSave);
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
      // Encode (encrypt-at-rest if locked) outside the transaction — crypto is async and
      // would otherwise let the Dexie transaction auto-commit prematurely.
      const encSnaps = await secureStore.encodeSnapshots(data.snapshots);
      const encGoals = await secureStore.encodeGoals(data.goals);
      await db.transaction('rw', db.snapshots, db.goals, db.preferences, db.syncMeta, async () => {
        await db.snapshots.clear();
        await db.goals.clear();
        await db.preferences.clear();
        await db.syncMeta.clear();
        if (encSnaps.length) await db.snapshots.bulkPut(encSnaps as unknown as Snapshot[]);
        if (encGoals.length) await db.goals.bulkPut(encGoals as unknown as Goal[]);
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
    if (isLocked) return; // never sync while gated — there is no DEK to encrypt writes with
    if (hasPulledRef.current) return;
    hasPulledRef.current = true;
    const prefs = prefsRef.current;
    if (prefs?.cloudSync?.enabled && prefs.cloudSync.provider === 'google' && googleDriveProvider.isSignedIn()) {
      pullFromCloud().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLocked]);

  const saveSnapshot = async (snapshot: Snapshot) => {
    const duplicate = snapshots.find(s => s.month === snapshot.month && s.id !== snapshot.id);
    if (duplicate) throw new Error(`duplicate_month:${snapshot.month}`);
    snapshot = { ...snapshot, updatedAt: new Date().toISOString() };
    await secureStore.putSnapshot(snapshot);
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
    await secureStore.putGoal(stamped);
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

  // ── App lock ────────────────────────────────────────────────────────────────
  const unlockWithDEK = async (dek: string) => {
    setSessionDEK(dek);
    setIsLocked(false);
    await load();
  };

  const unlockWithPassphrase = async (passphrase: string): Promise<boolean> => {
    const dek = await appLock.unlockWithPassphrase(passphrase);
    if (!dek) return false;
    // Reuse the same secret for Drive backup encryption so one entry covers both.
    setPassphrase(passphrase);
    await unlockWithDEK(dek);
    return true;
  };

  const lockNow = () => {
    if (!prefsRef.current?.appLock?.enabled) return;
    lockSession();
    setSnapshots([]);
    setGoals([]);
    setIsLocked(true);
  };

  const enableAppLock = async (passphrase: string) => {
    await appLock.enableAppLock(passphrase);
    setPassphrase(passphrase);
    await updatePreferences({
      appLock: { enabled: true, autoLockMinutes: 15, recovery: { code: false, googleEscrow: false } },
    });
  };

  const disableAppLock = async () => {
    await appLock.disableAppLock();
    await updatePreferences({ appLock: { enabled: false, autoLockMinutes: 15, recovery: { code: false, googleEscrow: false } } });
  };

  const changeAppLockPassphrase = async (newPassphrase: string) => {
    await appLock.changeAppLockPassphrase(newPassphrase);
    setPassphrase(newPassphrase);
  };

  const setRecoveryCode = async (enabled: boolean): Promise<string | null> => {
    const current = prefsRef.current?.appLock;
    if (!current) return null;
    let code: string | null = null;
    if (enabled) {
      code = await appLock.addRecoveryCode();
    } else {
      await appLock.removeRecoveryCode();
    }
    await updatePreferences({ appLock: { ...current, recovery: { ...current.recovery, code: enabled } } });
    return code;
  };

  const setGoogleEscrow = async (enabled: boolean) => {
    const current = prefsRef.current?.appLock;
    if (!current) return;
    if (enabled) await appLock.enableGoogleEscrow();
    else await appLock.disableGoogleEscrow();
    await updatePreferences({ appLock: { ...current, recovery: { ...current.recovery, googleEscrow: enabled } } });
  };

  const setPasskey = async (enabled: boolean) => {
    const current = prefsRef.current?.appLock;
    if (!current) return;
    if (enabled) await appLock.addPasskey();
    else await appLock.removePasskey();
    await updatePreferences({ appLock: { ...current, webauthnEnabled: enabled } });
  };

  // Auto-lock after idle. Active only while the lock is enabled and currently unlocked.
  useEffect(() => {
    if (!preferences?.appLock?.enabled || isLocked) return;
    const minutes = preferences.appLock.autoLockMinutes;
    if (!minutes || minutes <= 0) return; // 0 = only lock on tab close
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => lockNow(), minutes * 60_000);
    };
    const events: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.appLock?.enabled, preferences?.appLock?.autoLockMinutes, isLocked]);

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
      isLocked,
      unlockWithPassphrase,
      unlockWithDEK,
      lockNow,
      enableAppLock,
      disableAppLock,
      changeAppLockPassphrase,
      setRecoveryCode,
      setGoogleEscrow,
      setPasskey,
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
