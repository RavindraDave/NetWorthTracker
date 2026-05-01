import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { exportToJSON, parseBackupJSON, downloadFile, parseExcelToSnapshotItems } from '../utils/importExport';
import { Download, Upload, FileSpreadsheet, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import './Settings.css';

export const Settings: React.FC = () => {
  const { preferences, updatePreferences, snapshots, goals, restoreBackup, createNewSnapshot, saveSnapshot } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  if (!preferences) return null;

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

        if (window.confirm(
          'Warning: Importing a backup will replace ALL current data.\n\n' +
          'A safety backup of your CURRENT data will be downloaded automatically first.\n\n' +
          'Are you sure you want to proceed?'
        )) {
          // Auto-save current state before overwriting — gives user a recovery path
          if (snapshots.length > 0 || goals.length > 0) {
            const safetyJson = exportToJSON(snapshots, goals, preferences!);
            downloadFile(
              safetyJson,
              `wealthpulse-safety-backup-${new Date().toISOString().split('T')[0]}.json`,
              'application/json'
            );
            // Small delay to allow the browser to trigger the download
            await new Promise(resolve => setTimeout(resolve, 600));
          }
          await restoreBackup(backupData);
          alert('Backup restored successfully!');
        }
      } catch (err: any) {
        alert(`Failed to import backup: ${err.message}`);
        console.error(err);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.xlsx')) {
      alert('Please upload a valid .xlsx Excel file.');
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
      alert('Excel data imported as a new Snapshot for the current month!');
    } catch (err) {
      alert('Failed to parse Excel file.');
      console.error(err);
    }
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

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
            <label>Base Currency</label>
            <select 
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
      </div>
    </div>
  );
};
