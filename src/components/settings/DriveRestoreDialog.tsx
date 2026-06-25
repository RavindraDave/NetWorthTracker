import React from 'react';
import { Modal } from '../common/Modal';
import { CloudBackupFile } from '../../utils/cloudSync/types';
import { formatBytes } from '../../utils/storagePersist';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface DriveRestoreDialogProps {
  files: CloudBackupFile[];
  onRestore: (file: CloudBackupFile) => void;
  onClose: () => void;
  loading: boolean;
}

export const DriveRestoreDialog: React.FC<DriveRestoreDialogProps> = ({ files, onRestore, onClose, loading }) => (
  <Modal onClose={onClose} aria-label="Restore from Google Drive">
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Restore from Google Drive</h3>
      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
        Select a backup to restore. Your current data will be replaced (a safety download happens first).
      </p>
    </div>

    {loading ? (
      <p className="text-muted" style={{ fontSize: '0.85rem', padding: '1rem 0' }}>Loading backups…</p>
    ) : files.length === 0 ? (
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
            <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
              onClick={() => onRestore(f)}>
              Restore
            </button>
          </div>
        ))}
      </div>
    )}

    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
    </div>
  </Modal>
);
