import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { exportToJSON, parseBackupJSON, downloadFile, parseExcelToSnapshotItems } from '../utils/importExport';
import { ALL_CURRENCIES } from '../utils/currencies';
import { CategoryManager } from '../components/settings/CategoryManager';
import { AutoBackupRecord, AutoBackupConfig, BackupCadence } from '../types';
import { isFsaSupported, pickBackupFolder, getSavedFolderHandle, clearBackupFolder } from '../utils/fsAccessBackup';
import { Download, Upload, FileSpreadsheet, Settings as SettingsIcon, AlertTriangle, Sun, Moon, Monitor, Search, Archive, History, RefreshCw, Trash2, FolderOpen, FolderX } from 'lucide-react';
import './Settings.css';

export const Settings: React.FC = () => {
  const { preferences, updatePreferences, snapshots, goals, restoreBackup,
    restoreAutoBackup, listAutoBackups, deleteAutoBackup, manualBackup,
    createNewSnapshot, saveSnapshot } = useApp();
  const { success, error, warning, confirm } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [currencySearch, setCurrencySearch] = useState('');
  const [autoBackupHistory, setAutoBackupHistory] = useState<AutoBackupRecord[]>([]);
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [fsaFolderName, setFsaFolderName] = useState<string | null>(null);
  const fsaSupported = isFsaSupported();

  // Load persisted folder name on mount
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

  const toggleCurrency = (code: string) => {
    const enabled = preferences.enabledCurrencies;
    if (code === preferences.baseCurrency) return; // can't disable base
    const next = enabled.includes(code)
      ? enabled.filter(c => c !== code)
      : [...enabled, code];
    updatePreferences({ enabledCurrencies: next });
  };

  const filteredCurrencies = ALL_CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

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
            downloadFile(
              safetyJson,
              `wealthpulse-safety-backup-${new Date().toISOString().split('T')[0]}.json`,
              'application/json'
            );
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

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.xlsx')) {
      warning('Please upload a valid .xlsx Excel file.');
      if (excelInputRef.current) excelInputRef.current.value = '';
      return;
    }

    try {
      const rows = await parseExcelToSnapshotItems(file);
      const newSnap = createNewSnapshot();

      rows.forEach(row => {
        if (typeof row !== 'object' || !row) return;

        const catName = String(row['Category'] || 'Cash & Bank');
        const targetCat = newSnap.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());

        if (targetCat) {
          targetCat.items.push({
            id: crypto.randomUUID(),
            name: String(row['Asset Name'] || row['Name'] || 'Imported Item'),
            currency: String(row['Currency'] || preferences.baseCurrency),
            amount: parseFloat(String(row['Amount'])) || 0,
            excludeFromNetWorth: row['Excluded'] === 'Yes' || row['Excluded'] === true
          });
        }
      });

      await saveSnapshot(newSnap);
      success('Excel data imported as a new Snapshot for the current month!');
    } catch (err) {
      error('Failed to parse Excel file.');
      console.error(err);
    }
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  const autoBackupCfg: AutoBackupConfig = preferences.autoBackup ?? { enabled: true, cadence: 'weekly', mode: 'download' };

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
    // Safety download first
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

  const themeOptions: { value: 'dark' | 'light' | 'system'; label: string; icon: React.ReactNode }[] = [
    { value: 'light',  label: 'Light',  icon: <Sun size={16} /> },
    { value: 'dark',   label: 'Dark',   icon: <Moon size={16} /> },
    { value: 'system', label: 'System', icon: <Monitor size={16} /> },
  ];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="text-h1" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <SettingsIcon size={28} /> Settings
        </h1>
        <p className="text-muted">Manage your preferences and data backups.</p>
      </div>

      <div className="settings-grid">
        <div className="settings-section glass-card">
          <h2 className="text-h2" style={{ marginBottom: '1.5rem' }}>Preferences</h2>

          <div className="form-group">
            <label htmlFor="base-currency">Base Currency</label>
            <select
              id="base-currency"
              className="settings-input"
              value={preferences.baseCurrency}
              onChange={e => updatePreferences({ baseCurrency: e.target.value })}
            >
              {preferences.enabledCurrencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
              Your entire portfolio and FIRE targets will be converted to and displayed in this currency.
            </p>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Theme</label>
            <div className="theme-toggle-group">
              {themeOptions.map(opt => (
                <button
                  key={opt.value}
                  className={`theme-toggle-btn${preferences.theme === opt.value ? ' active' : ''}`}
                  onClick={() => updatePreferences({ theme: opt.value })}
                  aria-pressed={preferences.theme === opt.value}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Currency Picker */}
        <div className="settings-section glass-card">
          <h2 className="text-h2" style={{ marginBottom: '0.5rem' }}>Currencies</h2>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
            Toggle currencies to enable them in line items. Base currency cannot be disabled.
          </p>
          <div className="currency-search-row">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              className="settings-input currency-search-input"
              placeholder="Search currencies…"
              value={currencySearch}
              onChange={e => setCurrencySearch(e.target.value)}
              style={{ maxWidth: '100%' }}
            />
          </div>
          <div className="currency-grid">
            {filteredCurrencies.map(c => {
              const enabled = preferences.enabledCurrencies.includes(c.code);
              const isBase  = c.code === preferences.baseCurrency;
              return (
                <button
                  key={c.code}
                  className={`currency-chip${enabled ? ' active' : ''}${isBase ? ' base' : ''}`}
                  onClick={() => toggleCurrency(c.code)}
                  disabled={isBase}
                  title={c.name}
                  aria-pressed={enabled}
                >
                  <span className="currency-chip__code">{c.code}</span>
                  <span className="currency-chip__symbol">{c.symbol}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="settings-section glass-card">
          <CategoryManager />
        </div>

        <div className="settings-section glass-card">
          <h2 className="text-h2" style={{ marginBottom: '1.5rem' }}>Data Management</h2>

          <div className="data-action-card">
            <div className="data-action-card__info">
              <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={18} className="text-positive" /> Export Backup
              </h3>
              <p className="text-muted text-sm">Download your complete database as a JSON file for safekeeping.</p>
            </div>
            <button className="btn btn-outline" onClick={handleExport}>Download JSON</button>
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
                <FileSpreadsheet size={18} className="text-blue" /> Import from Excel
              </h3>
              <p className="text-muted text-sm">Import line items from an `.xlsx` file into a new Snapshot.</p>
            </div>
            <input type="file" accept=".xlsx" style={{ display: 'none' }} ref={excelInputRef} onChange={handleImportExcel} />
            <button className="btn btn-outline" onClick={() => excelInputRef.current?.click()}>Upload XLSX</button>
          </div>
        </div>

        {/* Auto-Backup */}
        <div className="settings-section glass-card">
          <h2 className="text-h2" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Archive size={20} /> Auto-Backup
          </h2>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            WealthPulse automatically saves up to 30 recovery points as you make changes. You can also schedule periodic file exports.
          </p>

          {/* Schedule config */}
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

          {/* FSA folder picker (Chrome/Edge only) */}
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

          {/* Manual backup + history toggle */}
          <div className="data-action-card" style={{ marginTop: '0.75rem' }}>
            <div className="data-action-card__info">
              <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={16} /> Recovery History
              </h3>
              <p className="text-muted text-sm">Up to 30 auto-saved recovery points. Restore, download, or delete any entry.</p>
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
                        <button
                          className="btn-icon"
                          title="Restore this backup"
                          onClick={() => handleRestoreAutoBackup(record)}
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Download as JSON"
                          onClick={() => handleDownloadAutoBackup(record)}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Delete this backup"
                          onClick={() => record.id != null && handleDeleteAutoBackup(record.id)}
                        >
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
      </div>
    </div>
  );
};
