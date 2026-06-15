import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, initializePreferences, UserPreferencesRecord } from '../db/database';
import { Snapshot, Goal, UserPreferences, AutoBackupRecord, CategoryTemplate } from '../types';
import { googleDriveProvider } from '../utils/cloudSync/google/drive';
import { configureClientId } from '../utils/cloudSync/google/gis';
import { encryptJSON, getPassphrase } from '../utils/cloudSync/encryption';

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
import { BackupData, exportToJSON, parseBackupJSON } from '../utils/importExport';
import { recordAutoBackup, listAutoBackups, deleteAutoBackup } from '../utils/autoBackup';
import { DEFAULT_CATEGORY_TEMPLATES, buildCategoryFromTemplate } from '../utils/defaultCategories';
import { ViewMode } from '../utils/calculations';
import { writeCanonicalFile, readCanonicalFileWithMeta, CanonicalConflictError } from '../utils/cloudSync/google/drive';
import { decryptJSON, isEncryptedEnvelope } from '../utils/cloudSync/encryption';
import { mergeBackups, applyResolutions, SyncResult } from '../utils/cloudSync/syncEngine';
import type { SyncMetaRecord } from '../db/database';

export interface SyncConflictState {
  result: SyncResult;
  // Drive version of the remote file these conflicts were computed against.
  remoteVersion?: number;
}

export type PullOutcome = 'merged' | 'conflicts' | 'noop' | 'error';

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

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overall');
  const [isLoading, setIsLoading] = useState(true);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictState | null>(null);

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
      setGoals(gs);

      // One-time migration: seed categoryTemplates from defaults + customCategories
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
      // Apply flag rehydration so all pages see current isLiquid/isInvestable from templates
      const rehydrated = finalPrefs?.categoryTemplates
        ? rehydrateFlags(snaps.map(normalizeRates), finalPrefs.categoryTemplates)
        : snaps.map(normalizeRates);
      setSnapshots(rehydrated);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pull from Drive once after initial load when sync is enabled
  const hasPulledRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (hasPulledRef.current) return;
    hasPulledRef.current = true;
    const prefs = prefsRef.current;
    if (prefs?.cloudSync?.enabled && prefs.cloudSync.provider === 'google') {
      pullFromCloud().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

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
    // Always stamp updatedAt so the sync engine can detect changes regardless of
    // which call site saved the snapshot (mirrors saveGoal).
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
      // Record the post-delete state so an auto-backup restore doesn't resurrect it.
      if (prefsRef.current) {
        recordAutoBackup('snapshot', next, goalsRef.current, prefsRef.current).catch(() => {});
      }
      return next;
    });
    // Propagate the deletion to Drive — without this the canonical file keeps the
    // deleted record until the next save, so other devices never see the removal.
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

  const restoreBackup = async (data: BackupData) => {
    setIsLoading(true);
    try {
      await db.transaction('rw', db.snapshots, db.goals, db.preferences, db.syncMeta, async () => {
        await db.snapshots.clear();
        await db.goals.clear();
        await db.preferences.clear();
        // Invalidate the three-way-merge base: after a full replace the old base
        // no longer describes this data, and a stale base can cause the next pull
        // to drop or re-introduce records. Sync paths re-seed it via storeSyncMeta.
        await db.syncMeta.clear();

        // bulkPut (not bulkAdd): tolerate duplicate ids in an imported/corrupt backup
        // rather than aborting the whole restore — the safety net must not be brittle.
        if (data.snapshots.length) await db.snapshots.bulkPut(data.snapshots);
        if (data.goals.length) await db.goals.bulkPut(data.goals);
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

  const storeSyncMeta = async (data: BackupData, baseVersion?: number) => {
    const record: SyncMetaRecord = {
      id: 1,
      updatedISO: new Date().toISOString(),
      base: JSON.stringify(data),
      baseVersion,
    };
    await db.syncMeta.put(record);
  };

  const loadSyncMeta = async (): Promise<BackupData | null> => {
    const record = await db.syncMeta.get(1);
    if (!record) return null;
    try { return JSON.parse(record.base) as BackupData; } catch { return null; }
  };

  const decryptPayload = async (payload: string): Promise<string> => {
    if (!isEncryptedEnvelope(payload)) return payload;
    const pass = getPassphrase();
    if (!pass) throw new Error('Encrypted backup — enter your passphrase in Settings → Google Drive Sync.');
    return decryptJSON(payload, pass);
  };

  const syncToCloud = async () => {
    // Read committed prefs from the DB, not prefsRef: callers may invoke this
    // immediately after updatePreferences(), before the ref-syncing effect runs
    // (e.g. enabling encryption then pushing). The DB is the source of truth.
    const prefs = (await db.preferences.get(1)) ?? prefsRef.current ?? undefined;
    if (!prefs?.cloudSync?.enabled || prefs.cloudSync.provider !== 'google') return;
    const snaps = snapshotsRef.current;
    const gs = goalsRef.current;
    if (snaps.length === 0) return;

    if (prefs.cloudSync.encryptionEnabled) {
      const pass = getPassphrase();
      if (!pass) {
        const updated = { ...prefs.cloudSync, lastError: 'Encryption enabled — enter your passphrase in Settings to sync.' };
        await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
        setPreferences(p => p ? { ...p, cloudSync: updated } : p);
        return;
      }
    }

    const plainJson = exportToJSON(snaps, gs, prefs);
    const plainData = JSON.parse(plainJson) as BackupData;
    // Version the remote was last reconciled against — guards against clobbering a
    // newer write from another device.
    const expectedVersion = (await db.syncMeta.get(1))?.baseVersion;
    try {
      const pass = prefs.cloudSync.encryptionEnabled ? getPassphrase() : null;
      const payload = pass ? await encryptJSON(plainJson, pass) : plainJson;

      // Update the canonical sync file (create on first push)
      const { version } = await writeCanonicalFile(payload, expectedVersion);

      // Also keep a dated backup for history
      const date = new Date().toISOString().split('T')[0];
      await googleDriveProvider.upload(payload, `wealthpulse-backup-${date}.json`);

      // Record the base state + version for future three-way merges
      await storeSyncMeta(plainData, version);

      const updated = { ...prefs.cloudSync, lastSyncISO: new Date().toISOString(), lastError: undefined };
      await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
      setPreferences(p => p ? { ...p, cloudSync: updated } : p);
    } catch (err) {
      if (err instanceof CanonicalConflictError) {
        // Remote advanced since our last pull. Pull & merge first; if that auto-merges
        // cleanly, re-push so the local edits still reach Drive. If it surfaces
        // conflicts, the resolveConflicts path will push after the user resolves.
        const outcome = await pullFromCloud();
        if (outcome === 'merged') debouncedCloudSync();
        return;
      }
      const msg = err instanceof Error ? err.message : 'Cloud sync failed';
      const updated = { ...prefs.cloudSync, lastError: msg };
      await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
      setPreferences(p => p ? { ...p, cloudSync: updated } : p);
    }
  };

  const pullFromCloud = async (): Promise<PullOutcome> => {
    const prefs = prefsRef.current;
    if (!prefs?.cloudSync?.enabled || prefs.cloudSync.provider !== 'google') return 'noop';

    try {
      const remoteFile = await readCanonicalFileWithMeta();
      if (!remoteFile) return 'noop'; // no canonical file yet — nothing to pull

      const plainJson = await decryptPayload(remoteFile.content);
      const remote = parseBackupJSON(plainJson);
      const base = await loadSyncMeta();

      const local: BackupData = {
        version: 1,
        exportDate: new Date().toISOString(),
        snapshots: snapshotsRef.current,
        goals: goalsRef.current,
        preferences: prefs,
      };

      const syncMode = prefs.cloudSync.syncMode ?? 'merge';

      if (syncMode === 'override') {
        // Replace local data with remote, keep local preferences
        await restoreBackup({ ...remote, preferences: local.preferences });
        await storeSyncMeta(remote, remoteFile.version);
        return 'merged';
      }

      // Merge mode
      const result = mergeBackups(base, local, remote);

      if (result.conflicts.length === 0) {
        // Auto-merge — apply silently
        await restoreBackup(result.merged);
        await storeSyncMeta(result.merged, remoteFile.version);
        return 'merged';
      } else {
        // Surface conflicts for user resolution
        setSyncConflicts({ result, remoteVersion: remoteFile.version });
        return 'conflicts';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull from Drive failed';
      const updated = { ...prefs.cloudSync, lastError: msg };
      await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
      setPreferences(p => p ? { ...p, cloudSync: updated } : p);
      return 'error';
    }
  };

  const resolveConflicts = async (resolutions: Map<string, 'local' | 'remote'>) => {
    if (!syncConflicts) return;
    const finalData = applyResolutions(syncConflicts.result, resolutions);
    await restoreBackup(finalData);
    // Base the resolved state on the remote version we merged against, so the
    // follow-up push passes the optimistic-concurrency guard.
    await storeSyncMeta(finalData, syncConflicts.remoteVersion);
    setSyncConflicts(null);
    // Push the resolved state back to Drive
    debouncedCloudSync();
  };

  const dismissSyncConflicts = () => {
    setSyncConflicts(null);
  };

  const debouncedCloudSync = () => {
    if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = setTimeout(() => { syncToCloud().catch(() => {}); }, 5000);
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
      exchangeRates: { USD: 83, SGD: 62, EUR: 90, GBP: 105, AED: 22.6, AUD: 54 },
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
    const nextYear = month === 12 ? year + 1 : year;
    const newMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

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
