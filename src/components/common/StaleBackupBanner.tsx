import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { exportToJSON, downloadFile } from '../../utils/importExport';
import { daysSinceISO, staleThresholdDays } from '../../utils/autoBackup';
import { Banner } from './Banner';
import { TEXT } from './theme';

const MAX_SNOOZE_MS = 40 * 24 * 60 * 60 * 1000; // beyond the longest stale threshold (35 days) — reject tampered far-future dates

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

  // Grace period for brand-new users: don't nag the moment the first snapshot is
  // saved. Only prompt once there's history worth protecting — a 2nd snapshot, or
  // 24h of use. (Only applies when they've never backed up; once they have, the
  // normal cadence-based staleness logic below takes over.)
  if (!preferences.autoBackup?.lastRunISO && snapshots.length < 2) {
    const oldestISO = snapshots.reduce(
      (min, s) => (s.createdAt < min ? s.createdAt : min),
      snapshots[0].createdAt,
    );
    const hoursSinceFirst = (Date.now() - new Date(oldestISO).getTime()) / (60 * 60 * 1000);
    if (Number.isFinite(hoursSinceFirst) && hoursSinceFirst < 24) return null;
  }

  const daysSinceBackup = daysSinceISO(preferences.autoBackup?.lastRunISO);
  if (daysSinceBackup <= staleThresholdDays(preferences.autoBackup?.cadence)) return null;

  const handleBackupNow = async () => {
    await manualBackup();
    const json = exportToJSON(snapshots, goals, preferences);
    downloadFile(json, `wealthpulse-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    await updatePreferences({ autoBackup: { ...(preferences.autoBackup ?? { enabled: true, cadence: 'weekly', mode: 'download' }), lastRunISO: new Date().toISOString() } });
  };

  const handleSnooze = async () => {
    // Snooze for the same duration as the staleness threshold so we don't re-nag before it's actually stale again
    const snoozeDays = staleThresholdDays(preferences.autoBackup?.cadence);
    const snoozeUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString();
    await updatePreferences({ staleBackupSnoozeUntil: snoozeUntil });
  };

  return (
    <Banner
      variant="warning"
      icon={<AlertTriangle size={16} />}
      actions={
        <>
          <button className="btn btn-outline" style={{ fontSize: TEXT.base, padding: '0.3rem 0.7rem' }} onClick={handleBackupNow}>
            Back up now
          </button>
          <button className="btn-icon" aria-label="Dismiss reminder" title="Dismiss reminder" onClick={handleSnooze}>
            <X size={14} />
          </button>
        </>
      }
    >
      Your last backup was {preferences.autoBackup?.lastRunISO
        ? `${daysSinceBackup} days ago`
        : 'never'
      }. Back up your data to keep it safe.
    </Banner>
  );
};
