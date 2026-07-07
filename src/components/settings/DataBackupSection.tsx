import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { exportToJSON, parseBackupJSON, downloadFile, exportAllToExcel } from '../../utils/importExport';
import { AutoBackupRecord, AutoBackupConfig, BackupCadence } from '../../types';
import { isFsaSupported, pickBackupFolder, getSavedFolderHandle, clearBackupFolder } from '../../utils/fsAccessBackup';
import { MAX_BACKUPS } from '../../utils/autoBackup';
import { Download, Upload, FileSpreadsheet, FileText, AlertTriangle, Archive, History, RefreshCw, Trash2, FolderOpen, FolderX } from 'lucide-react';
import { StorageStatusCard } from './StorageStatusCard';
import { InstallPwaCard } from '../common/InstallPwaCard';
import { NotificationPermissionCard } from './NotificationPermissionCard';
import { CsvImportModal } from './CsvImportModal';

export const DataBackupSection: React.FC = () => {
  const { preferences, updatePreferences, snapshots, goals, restoreBackup,
    restoreAutoBackup, listAutoBackups, deleteAutoBackup, manualBackup } = useApp();
  const { success, error, confirm } = useToast();

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const csvInputRef   = useRef<HTMLInputElement>(null);

  const [csvImportFile, setCsvImportFile]     = useState<File | null>(null);
  const [autoBackupHistory, setAutoBackupHistory] = useState<AutoBackupRecord[]>([]);
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [fsaFolderName, setFsaFolderName]     = useState<string | null>(null);
  const fsaSupported = isFsaSupported();

  useEffect(() => {
    if (!fsaSupported) return;
    getSavedFolderHandle().then(handle => {
      if (handle) setFsaFolderName(handle.name);
    });
  }, [fsaSupported]);

  const refreshBackupHistory = useCallback(async () => {
    const records = await listAutoBackups();
    setAutoBackupHistory(records);
  }, [listAutoBackups]);

  useEffect(() => {
    if (showBackupHistory) refreshBackupHistory();
  }, [showBackupHistory, refreshBackupHistory]);

  if (!preferences) return null;

  const autoBackupCfg: AutoBackupConfig = preferences.autoBackup ?? { enabled: true, cadence: 'weekly', mode: 'download' };

  const handleExport = () => {
    const jsonStr = exportToJSON(snapshots, goals, preferences);
    downloadFile(jsonStr, `wealthpulse-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const backupData = parseBackupJSON(jsonStr);
        const ok = await confirm(
          'Warning: Importing a backup will replace ALL current data.\n\n' +
          'A safety backup of your CURRENT data will be downloaded automatically first.\n\n' +
          'Are you sure you want to proceed?'
        );
        if (ok) {
          if (snapshots.length > 0 || goals.length > 0) {
            const safetyJson = exportToJSON(snapshots, goals, preferences!);
            downloadFile(safetyJson, `wealthpulse-safety-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
            await new Promise(resolve => setTimeout(resolve, 600));
          }
          await restoreBackup(backupData);
          success('Backup restored successfully!');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        error(`Failed to import backup: ${msg}`);
        console.error(err);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // CSV and Excel share one path: both go through the column-mapper modal,
  // which auto-detects the app's own export headers (Item Name/Category/…),
  // creates missing categories instead of dropping rows, and lets the user
  // pick the target month.
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImportFile(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleAutoBackupToggle = () => {
    updatePreferences({ autoBackup: { ...autoBackupCfg, enabled: !autoBackupCfg.enabled } });
  };

  const handleCadenceChange = (cadence: BackupCadence) => {
    updatePreferences({ autoBackup: { ...autoBackupCfg, cadence } });
  };

  const handleManualBackup = async () => {
    await manualBackup();
    success('Manual backup saved to history.');
    if (showBackupHistory) await refreshBackupHistory();
  };

  const handleRestoreAutoBackup = async (record: AutoBackupRecord) => {
    const ok = await confirm(
      `Restore backup from ${new Date(record.createdAt).toLocaleString()}?\n\nThis will overwrite all current data. A safety backup will be downloaded first.`,
      'destructive'
    );
    if (!ok) return;
    const safetyJson = exportToJSON(snapshots, goals, preferences!);
    downloadFile(safetyJson, `wealthpulse-safety-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    await new Promise(r => setTimeout(r, 600));
    await restoreAutoBackup(record);
    success('Auto-backup restored successfully!');
  };

  const handleDeleteAutoBackup = async (id: number) => {
    await deleteAutoBackup(id);
    await refreshBackupHistory();
  };

  const handlePickFolder = async () => {
    const handle = await pickBackupFolder();
    if (handle) {
      setFsaFolderName(handle.name);
      updatePreferences({ autoBackup: { ...autoBackupCfg, mode: 'fsa' } });
      success(`Backup folder set to "${handle.name}". Future scheduled backups will write there.`);
    }
  };

  const handleClearFolder = async () => {
    await clearBackupFolder();
    setFsaFolderName(null);
    updatePreferences({ autoBackup: { ...autoBackupCfg, mode: 'download' } });
    success('Backup folder cleared. Scheduled backups will use file downloads again.');
  };

  const handleDownloadAutoBackup = (record: AutoBackupRecord) => {
    const json = exportToJSON(record.snapshots, record.goals, record.preferences);
    downloadFile(json, `wealthpulse-autobackup-${record.createdAt.split('T')[0]}.json`, 'application/json');
  };

  return (
    <>
      <div className="wp-card settings-section">
        <h2 className="settings-h2">Data & Backup</h2>

        <StorageStatusCard />
        <InstallPwaCard />
        <NotificationPermissionCard />

        <div className="data-action-card">
          <div className="data-action-card__info">
            <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={18} className="text-positive" /> Export Backup
            </h3>
            <p className="text-muted text-sm">Download your complete database as a JSON file for safekeeping.</p>
          </div>
          <button className="btn btn-outline" onClick={handleExport}>Download JSON</button>
        </div>

        <div className="settings-row">
          <div>
            <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={18} className="text-positive" /> Export History to Excel
            </h3>
            <p className="text-muted text-sm">Download all snapshots as a multi-sheet Excel workbook — one summary sheet plus a detail sheet per month.</p>
          </div>
          <button className="btn btn-outline" onClick={() => exportAllToExcel(snapshots, preferences.baseCurrency)} disabled={snapshots.length === 0}>
            Download .xlsx
          </button>
        </div>

        <div className="data-action-card">
          <div className="data-action-card__info">
            <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={18} className="text-negative" /> Restore Backup
            </h3>
            <p className="text-muted text-sm">Upload a previously exported JSON backup. <br/><span className="text-negative"><AlertTriangle size={12} style={{display:'inline'}}/> Overwrites all current data.</span></p>
          </div>
          <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImportJSON} />
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>Select JSON</button>
        </div>

        <div className="data-action-card">
          <div className="data-action-card__info">
            <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} className="text-blue" /> Import from CSV / Excel
            </h3>
            <p className="text-muted text-sm">Import line items from any bank, broker, or WealthPulse export (.csv or .xlsx). Map columns visually, pick the snapshot month, then review before saving.</p>
          </div>
          <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} ref={csvInputRef} onChange={handleImportCsv} />
          <button className="btn btn-outline" onClick={() => csvInputRef.current?.click()}>Upload file</button>
        </div>

        <h2 className="settings-h2" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Archive size={18} /> Auto-Backup
        </h2>
        <p className="settings-hint" style={{ marginBottom: '1rem' }}>
          WealthPulse automatically saves up to {MAX_BACKUPS} recovery points. You can also schedule periodic file exports.
        </p>

        <div className="data-action-card" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div className="data-action-card__info">
            <h3 className="text-h3">Scheduled File Export</h3>
            <p className="text-muted text-sm">Auto-download a backup JSON on a schedule when the app is open.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className={`btn ${autoBackupCfg.enabled ? 'btn-primary' : 'btn-outline'}`}
              style={{ minWidth: '80px' }}
              onClick={handleAutoBackupToggle}
            >
              {autoBackupCfg.enabled ? 'Enabled' : 'Disabled'}
            </button>
            <select
              className="settings-input"
              style={{ width: 'auto' }}
              value={autoBackupCfg.cadence}
              disabled={!autoBackupCfg.enabled}
              onChange={e => handleCadenceChange(e.target.value as BackupCadence)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {fsaSupported && (
          <div className="data-action-card" style={{ marginTop: '0.75rem' }}>
            <div className="data-action-card__info">
              <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderOpen size={16} /> Backup Folder (Chrome/Edge)
              </h3>
              <p className="text-muted text-sm">
                {fsaFolderName
                  ? <>Backups will write silently to <strong>{fsaFolderName}</strong>.</>
                  : 'Pick a folder and scheduled backups write there silently instead of downloading.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={handlePickFolder}>
                <FolderOpen size={14} style={{ marginRight: '0.3rem' }} />
                {fsaFolderName ? 'Change Folder' : 'Pick Folder'}
              </button>
              {fsaFolderName && (
                <button className="btn btn-outline" onClick={handleClearFolder}>
                  <FolderX size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="data-action-card" style={{ marginTop: '0.75rem' }}>
          <div className="data-action-card__info">
            <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={16} /> Recovery History
            </h3>
            <p className="text-muted text-sm">Up to {MAX_BACKUPS} auto-saved recovery points. Restore, download, or delete any entry.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={handleManualBackup}>Save Now</button>
            <button className="btn btn-outline" onClick={() => setShowBackupHistory(v => !v)}>
              {showBackupHistory ? 'Hide' : 'Show'} History ({autoBackupHistory.length || '…'})
            </button>
          </div>
        </div>

        {showBackupHistory && (
          <div className="auto-backup-history" style={{ marginTop: '1rem' }}>
            {autoBackupHistory.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                No auto-backups yet. Make a change to the app or click "Save Now" to create the first one.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {autoBackupHistory.map(record => (
                  <div key={record.id} className="auto-backup-row">
                    <div className="auto-backup-row__info">
                      <span className="auto-backup-row__date">
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                      <span className="auto-backup-row__meta">
                        {record.trigger} · {record.snapshots.length} snapshots · {record.goals.length} goals
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn-icon" title="Restore this backup" onClick={() => handleRestoreAutoBackup(record)}>
                        <RefreshCw size={14} />
                      </button>
                      <button className="btn-icon" title="Download as JSON" onClick={() => handleDownloadAutoBackup(record)}>
                        <Download size={14} />
                      </button>
                      <button className="btn-icon danger" title="Delete this backup" onClick={() => record.id != null && handleDeleteAutoBackup(record.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {csvImportFile && (
        <CsvImportModal
          file={csvImportFile}
          onClose={() => setCsvImportFile(null)}
        />
      )}
    </>
  );
};
