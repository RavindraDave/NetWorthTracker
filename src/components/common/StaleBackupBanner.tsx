import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { exportToJSON, downloadFile } from '../../utils/importExport';
import { daysSinceISO, staleThresholdDays } from '../../utils/autoBackup';

const MAX_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — reject tampered far-future dates

function isSnoozed(snoozeUntil: string | undefined): boolean {
  if (!snoozeUntil) return false;
  const until = new Date(snoozeUntil).getTime();
  if (!Number.isFinite(until)) return false;
  if (until > Date.now() + MAX_SNOOZE_MS) return false; // treat implausible future dates as not-snoozed
  return Date.now() < until;
}

export const StaleBackupBanner: React.FC = () => {
  const { snapshots, goals, preferences, manualBackup, updatePreferences } = useApp();

  if (!preferences) return null;
  if (snapshots.length === 0) return null;
  if (isSnoozed(preferences.staleBackupSnoozeUntil)) return null;

  const daysSinceBackup = daysSinceISO(preferences.autoBackup?.lastRunISO);
  if (daysSinceBackup <= staleThresholdDays(preferences.autoBackup?.cadence)) return null;

  const handleBackupNow = async () => {
    await manualBackup();
    const json = exportToJSON(snapshots, goals, preferences);
    downloadFile(json, `wealthpulse-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    await updatePreferences({ autoBackup: { ...(preferences.autoBackup ?? { enabled: true, cadence: 'weekly', mode: 'download' }), lastRunISO: new Date().toISOString() } });
  };

  const handleSnooze = async () => {
    // Snooze duration matches the backup cadence so we don't nag before the next window
    const cadence = preferences.autoBackup?.cadence;
    const snoozeDays = cadence === 'daily' ? 1 : cadence === 'weekly' ? 3 : 7;
    const snoozeUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString();
    await updatePreferences({ staleBackupSnoozeUntil: snoozeUntil });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.65rem 1rem',
      marginBottom: '1rem',
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--accent-yellow, #f59e0b) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--accent-yellow, #f59e0b) 40%, transparent)',
      flexWrap: 'wrap',
    }}>
      <AlertTriangle size={16} style={{ color: 'var(--accent-yellow, #f59e0b)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
        Your last backup was {preferences.autoBackup?.lastRunISO
          ? `${daysSinceBackup} days ago`
          : 'never'
        }. Back up your data to keep it safe.
      </span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={handleBackupNow}>
          Back up now
        </button>
        <button className="btn-icon" aria-label="Dismiss reminder" title="Dismiss reminder" onClick={handleSnooze}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
