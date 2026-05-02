import { useEffect, useRef } from 'react';
import { Snapshot, Goal, UserPreferences, AutoBackupConfig } from '../types';
import { exportToJSON, downloadFile } from '../utils/importExport';
import { writeFsaBackup } from '../utils/fsAccessBackup';

const CADENCE_MS: Record<string, number> = {
  daily:   24 * 60 * 60 * 1000,
  weekly:  7  * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // check every 30 min while app is open

interface UseAutoBackupParams {
  snapshots: Snapshot[];
  goals: Goal[];
  preferences: UserPreferences | null;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
}

export function useAutoBackup({ snapshots, goals, preferences, updatePreferences }: UseAutoBackupParams) {
  const snapshotsRef = useRef(snapshots);
  const goalsRef = useRef(goals);
  const prefsRef = useRef(preferences);
  const updatePrefsRef = useRef(updatePreferences);

  useEffect(() => { snapshotsRef.current = snapshots; }, [snapshots]);
  useEffect(() => { goalsRef.current = goals; }, [goals]);
  useEffect(() => { prefsRef.current = preferences; }, [preferences]);
  useEffect(() => { updatePrefsRef.current = updatePreferences; }, [updatePreferences]);

  useEffect(() => {
    const check = async () => {
      const prefs = prefsRef.current;
      if (!prefs) return;

      const cfg: AutoBackupConfig = prefs.autoBackup ?? { enabled: true, cadence: 'weekly', mode: 'download' };
      if (!cfg.enabled || cfg.cadence === ('off' as string)) return;

      const cadenceMs = CADENCE_MS[cfg.cadence];
      if (!cadenceMs) return;

      const lastRun = cfg.lastRunISO ? new Date(cfg.lastRunISO).getTime() : 0;
      if (Date.now() - lastRun < cadenceMs) return;

      const snaps = snapshotsRef.current;
      const gs = goalsRef.current;

      if (snaps.length === 0) return;

      const date = new Date().toISOString().split('T')[0];
      const filename = `wealthpulse-backup-${date}.json`;
      const json = exportToJSON(snaps, gs, prefs);

      if (cfg.mode === 'fsa') {
        const wrote = await writeFsaBackup(filename, json).catch(() => false);
        if (!wrote) {
          downloadFile(json, filename, 'application/json');
        }
      } else {
        downloadFile(json, filename, 'application/json');
      }

      // Record the run time (fire-and-forget, don't let failure stop the app)
      updatePrefsRef.current({
        autoBackup: { ...cfg, lastRunISO: new Date().toISOString() },
      }).catch(() => {});
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
}
