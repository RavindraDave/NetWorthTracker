import { useState, useRef } from 'react';
import { db, UserPreferencesRecord } from '../db/database';
import { Snapshot, Goal, UserPreferences, BackupData } from '../types';
import { exportToJSON, parseBackupJSON } from '../utils/importExport';
import { googleDriveProvider } from '../utils/cloudSync/google/drive';
import { encryptJSON, getPassphrase, decryptJSON, isEncryptedEnvelope } from '../utils/cloudSync/encryption';
import { writeCanonicalFile, readCanonicalFileWithMeta, CanonicalConflictError } from '../utils/cloudSync/google/drive';
import { mergeBackups, applyResolutions, SyncResult } from '../utils/cloudSync/syncEngine';
import { encodeSyncMetaBase, decodeSyncMetaBase } from '../utils/secureStore';
import type { SyncMetaRecord } from '../db/database';

export interface SyncConflictState {
  result: SyncResult;
  remoteVersion?: number;
}

export type PullOutcome = 'merged' | 'conflicts' | 'noop';

interface CloudSyncDeps {
  snapshotsRef: React.MutableRefObject<Snapshot[]>;
  goalsRef: React.MutableRefObject<Goal[]>;
  prefsRef: React.MutableRefObject<UserPreferences | null>;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences | null>>;
  restoreBackup: (data: BackupData) => Promise<void>;
}

export function useCloudSync({ snapshotsRef, goalsRef, prefsRef, setPreferences, restoreBackup }: CloudSyncDeps) {
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictState | null>(null);
  const cloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storeSyncMeta = async (data: BackupData, baseVersion?: number) => {
    const record: SyncMetaRecord = {
      id: 1,
      updatedISO: new Date().toISOString(),
      base: await encodeSyncMetaBase(JSON.stringify(data)), // encrypted at rest when locked
      baseVersion,
    };
    await db.syncMeta.put(record);
  };

  const loadSyncMeta = async (): Promise<BackupData | null> => {
    const record = await db.syncMeta.get(1);
    if (!record) return null;
    try { return JSON.parse(await decodeSyncMetaBase(record.base)) as BackupData; } catch { return null; }
  };

  const decryptPayload = async (payload: string): Promise<string> => {
    if (!isEncryptedEnvelope(payload)) return payload;
    const pass = getPassphrase();
    if (!pass) throw new Error('Encrypted backup — enter your passphrase in Settings → Google Drive Sync.');
    return decryptJSON(payload, pass);
  };

  // Forward declaration refs so syncToCloud and pullFromCloud can call each other
  const pullFromCloudRef = useRef<(opts?: { background?: boolean }) => Promise<PullOutcome>>(async () => 'noop');
  const debouncedCloudSyncRef = useRef<() => void>(() => {});

  const syncToCloud = async () => {
    const prefs = (await db.preferences.get(1)) ?? prefsRef.current ?? undefined;
    if (!prefs?.cloudSync?.enabled || prefs.cloudSync.provider !== 'google') return;
    const snaps = snapshotsRef.current;
    const gs = goalsRef.current;
    if (snaps.length === 0) return;

    if (!googleDriveProvider.isSignedIn()) {
      const msg = 'Google Drive session expired. Reconnect in Settings → Cloud Sync.';
      const updated = { ...prefs.cloudSync, lastError: msg };
      await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
      setPreferences(p => p ? { ...p, cloudSync: updated } : p);
      throw new Error(msg);
    }

    if (prefs.cloudSync.encryptionEnabled) {
      const pass = getPassphrase();
      if (!pass) {
        const msg = 'Encryption enabled — enter your passphrase in Settings to sync.';
        const updated = { ...prefs.cloudSync, lastError: msg };
        await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
        setPreferences(p => p ? { ...p, cloudSync: updated } : p);
        throw new Error(msg);
      }
    }

    const plainJson = exportToJSON(snaps, gs, prefs);
    const plainData = JSON.parse(plainJson) as BackupData;
    const expectedVersion = (await db.syncMeta.get(1))?.baseVersion;
    try {
      const pass = prefs.cloudSync.encryptionEnabled ? getPassphrase() : null;
      const payload = pass ? await encryptJSON(plainJson, pass) : plainJson;
      const { version } = await writeCanonicalFile(payload, expectedVersion);
      const date = new Date().toISOString().split('T')[0];
      await googleDriveProvider.upload(payload, `wealthpulse-backup-${date}.json`);
      await storeSyncMeta(plainData, version);
      const updated = { ...prefs.cloudSync, lastSyncISO: new Date().toISOString(), lastError: undefined };
      await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
      setPreferences(p => p ? { ...p, cloudSync: updated } : p);
    } catch (err) {
      if (err instanceof CanonicalConflictError) {
        // Force merge semantics here, even if the user's pull preference is "override" —
        // a background write conflict should never silently clobber local data unattended.
        const outcome = await pullFromCloudRef.current({ background: true });
        if (outcome === 'merged') { debouncedCloudSyncRef.current(); return; }
        if (outcome === 'conflicts') throw new Error('Drive has newer changes that conflict with yours — resolve below.');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Cloud sync failed';
      const updated = { ...prefs.cloudSync, lastError: msg };
      await db.preferences.put({ ...(prefs as UserPreferencesRecord), cloudSync: updated, id: 1 });
      setPreferences(p => p ? { ...p, cloudSync: updated } : p);
      throw err instanceof Error ? err : new Error(msg);
    }
  };

  const pullFromCloud = async (opts?: { background?: boolean }): Promise<PullOutcome> => {
    const prefs = prefsRef.current;
    if (!prefs?.cloudSync?.enabled || prefs.cloudSync.provider !== 'google') return 'noop';

    try {
      const remoteFile = await readCanonicalFileWithMeta();
      if (!remoteFile) return 'noop';

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

      // A background write conflict never honors "override" — that would silently
      // clobber local data with no user action. Only an explicit user-triggered pull does.
      const syncMode = opts?.background ? 'merge' : (prefs.cloudSync.syncMode ?? 'merge');

      if (syncMode === 'override') {
        await restoreBackup({ ...remote, preferences: local.preferences });
        await storeSyncMeta(remote, remoteFile.version);
        return 'merged';
      }

      const result = mergeBackups(base, local, remote);

      if (result.conflicts.length === 0) {
        await restoreBackup(result.merged);
        await storeSyncMeta(result.merged, remoteFile.version);
        return 'merged';
      } else {
        setSyncConflicts({ result, remoteVersion: remoteFile.version });
        return 'conflicts';
      }
    } catch (err) {
      const prefs = prefsRef.current;
      const msg = err instanceof Error ? err.message : 'Pull from Drive failed';
      if (prefs?.cloudSync) {
        const updated = { ...prefs.cloudSync, lastError: msg };
        await db.preferences.put({ ...(prefs as unknown as UserPreferencesRecord), cloudSync: updated, id: 1 });
        setPreferences(p => p ? { ...p, cloudSync: updated } : p);
      }
      throw err instanceof Error ? err : new Error(msg);
    }
  };

  const resolveConflicts = async (resolutions: Map<string, 'local' | 'remote'>) => {
    if (!syncConflicts) return;
    const finalData = applyResolutions(syncConflicts.result, resolutions);
    await restoreBackup(finalData);
    await storeSyncMeta(finalData, syncConflicts.remoteVersion);
    setSyncConflicts(null);
    debouncedCloudSyncRef.current();
  };

  const dismissSyncConflicts = async () => {
    if (!syncConflicts) return;
    // Keep local for still-conflicting records (already the case in `merged`),
    // but don't discard the auto-merged non-conflicting changes from this pull.
    await restoreBackup(syncConflicts.result.merged);
    await storeSyncMeta(syncConflicts.result.merged, syncConflicts.remoteVersion);
    setSyncConflicts(null);
  };

  const debouncedCloudSync = () => {
    if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = setTimeout(() => { syncToCloud().catch(() => {}); }, 5000);
  };

  // Keep forward-declaration refs up to date so cross-references work
  pullFromCloudRef.current = pullFromCloud;
  debouncedCloudSyncRef.current = debouncedCloudSync;

  return {
    syncConflicts,
    syncToCloud,
    pullFromCloud,
    resolveConflicts,
    dismissSyncConflicts,
    debouncedCloudSync,
  };
}
