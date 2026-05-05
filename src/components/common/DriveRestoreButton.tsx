import React, { useState } from 'react';
import { Cloud, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { CloudBackupFile } from '../../utils/cloudSync/types';
import { googleDriveProvider, listBackups, downloadBackup } from '../../utils/cloudSync/google/drive';
import { parseBackupJSON, downloadFile, exportToJSON } from '../../utils/importExport';
import { formatBytes } from '../../utils/storagePersist';
import { isClientIdConfigured } from '../../utils/cloudSync/google/gis';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export const DriveRestoreButton: React.FC = () => {
  const { snapshots, goals, preferences, restoreBackup, updatePreferences } = useApp();
  const { success, error, confirm } = useToast();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<CloudBackupFile[] | null>(null);

  // Only show if a client ID is available (either from build env or from user-saved preferences).
  // Note: on a fully cleared browser, the stored clientId is also gone. In that case,
  // the user needs to re-enter their Client ID in Settings → Cloud Sync first.
  if (!isClientIdConfigured()) {
    return (
      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
        To restore from Google Drive, configure your Client ID in{' '}
        <strong>Settings → Cloud Sync</strong> first.
      </p>
    );
  }

  const handleOpen = async () => {
    setLoading(true);
    try {
      if (!googleDriveProvider.isSignedIn()) {
        await googleDriveProvider.signIn();
        await updatePreferences({ cloudSync: { provider: 'google', enabled: true } });
      }
      const list = await listBackups();
      setFiles(list);
    } catch {
      error('Could not connect to Google Drive. Check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (file: CloudBackupFile) => {
    const ok = await confirm(
      `Restore backup from ${formatDate(file.modifiedTime)}?\n\nThis will replace all current data.`,
      'destructive',
    );
    if (!ok) return;

    if (snapshots.length > 0 || goals.length > 0) {
      const safetyJson = exportToJSON(snapshots, goals, preferences!);
      downloadFile(safetyJson, `wealthpulse-safety-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const json = await downloadBackup(file.id);
      const data = parseBackupJSON(json);
      await restoreBackup(data);
      setFiles(null);
      success('Backup restored successfully!');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  return (
    <>
      <div style={{ marginTop: '1rem' }}>
        <button
          className="btn btn-outline"
          onClick={handleOpen}
          disabled={loading}
          style={{ fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Cloud size={16} />
          {loading ? 'Connecting…' : 'Restore from Google Drive'}
        </button>
      </div>

      {files !== null && (
        <Modal onClose={() => setFiles(null)} aria-label="Restore from Google Drive">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Restore from Google Drive</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
              Select a backup. Your current data will be replaced.
            </p>
          </div>
          {files.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem', padding: '1rem 0' }}>No backups found on Google Drive.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '320px', overflowY: 'auto' }}>
              {files.map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-glass)', border: '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(f.modifiedTime)}</p>
                    {f.size !== undefined && (
                      <p className="text-muted" style={{ margin: 0, fontSize: '0.75rem' }}>{formatBytes(f.size)}</p>
                    )}
                  </div>
                  <button className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    onClick={() => handleRestore(f)}>
                    <Download size={13} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-outline" onClick={() => setFiles(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
};
