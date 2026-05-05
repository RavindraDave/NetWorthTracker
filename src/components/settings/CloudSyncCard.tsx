import React, { useState, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, Download, LogOut, AlertCircle, ExternalLink, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { googleDriveProvider } from '../../utils/cloudSync/google/drive';
import { listBackups, downloadBackup } from '../../utils/cloudSync/google/drive';
import { CloudBackupFile } from '../../utils/cloudSync/types';
import { parseBackupJSON, exportToJSON, downloadFile } from '../../utils/importExport';
import { formatBytes } from '../../utils/storagePersist';
import { configureClientId, isClientIdConfigured } from '../../utils/cloudSync/google/gis';
import type { CloudSyncConfig } from '../../types';

const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function maskClientId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// ── Restore picker dialog ─────────────────────────────────────────────────────

interface RestoreDialogProps {
  files: CloudBackupFile[];
  onRestore: (file: CloudBackupFile) => void;
  onClose: () => void;
  loading: boolean;
}

const RestoreDialog: React.FC<RestoreDialogProps> = ({ files, onRestore, onClose, loading }) => (
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

// ── Client ID setup form ──────────────────────────────────────────────────────

interface ClientIdFormProps {
  savedId: string;
  onSave: (id: string) => Promise<void>;
  onClear: () => Promise<void>;
}

const ClientIdForm: React.FC<ClientIdFormProps> = ({ savedId, onSave, onClear }) => {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const isValid = input.trim().length > 10 && input.includes('.apps.googleusercontent.com');

  const handleSave = async () => {
    setSaving(true);
    await onSave(input.trim());
    setInput('');
    setSaving(false);
  };

  if (savedId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <code style={{ fontSize: '0.8rem', background: 'var(--surface-glass)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
          {maskClientId(savedId)}
        </code>
        <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={onClear}>
          Remove
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <p className="text-muted" style={{ fontSize: '0.8rem' }}>
        Paste your OAuth 2.0 Client ID from Google Cloud Console.{' '}
        <a href="#cloud-sync-setup" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
          Setup guide <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
        </a>
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="line-item-input"
          placeholder="xxxxxx.apps.googleusercontent.com"
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{ flex: '1 1 260px', fontSize: '0.85rem' }}
          aria-label="Google OAuth Client ID"
        />
        <button className="btn btn-primary" onClick={handleSave} disabled={!isValid || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};

// ── Main card ─────────────────────────────────────────────────────────────────

export const CloudSyncCard: React.FC = () => {
  const { preferences, updatePreferences, snapshots, goals, syncToCloud, restoreBackup } = useApp();
  const { success, error, confirm } = useToast();

  const [signingIn, setSigningIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreFiles, setRestoreFiles] = useState<CloudBackupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const cloudSync: CloudSyncConfig = preferences?.cloudSync ?? { provider: null, enabled: false };
  const isEnabled = cloudSync.enabled && cloudSync.provider === 'google';
  const signedIn = googleDriveProvider.isSignedIn();
  const email = googleDriveProvider.getEmail();

  // The Client ID is either baked into the build (Vercel env) or saved by the user in Settings.
  const savedClientId = cloudSync.clientId ?? '';
  const clientIdReady = isClientIdConfigured();

  const handleSaveClientId = async (id: string) => {
    configureClientId(id);
    await updatePreferences({ cloudSync: { ...cloudSync, clientId: id } });
    success('Client ID saved. You can now connect to Google Drive.');
  };

  const handleClearClientId = async () => {
    configureClientId('');
    await updatePreferences({ cloudSync: { ...cloudSync, clientId: undefined, provider: null, enabled: false } });
    await googleDriveProvider.signOut().catch(() => {});
    success('Client ID removed. Google Drive sync disabled.');
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await googleDriveProvider.signIn();
      await updatePreferences({ cloudSync: { ...cloudSync, provider: 'google', enabled: true } });
      success('Signed in to Google Drive. Syncing…');
      await syncToCloud();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Sign-in failed. Make sure your Client ID and authorized domain are correct.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    const ok = await confirm('Sign out of Google Drive? Auto-sync will stop but your local data is safe.');
    if (!ok) return;
    await googleDriveProvider.signOut();
    await updatePreferences({ cloudSync: { ...cloudSync, provider: null, enabled: false } });
    success('Signed out of Google Drive.');
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await syncToCloud();
      success('Synced to Google Drive.');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Sync failed. Try signing in again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenRestore = useCallback(async () => {
    setShowRestoreDialog(true);
    setLoadingFiles(true);
    try {
      if (!signedIn) await googleDriveProvider.signIn();
      const files = await listBackups();
      setRestoreFiles(files);
    } catch {
      error('Could not load Drive backups. Try signing in again.');
      setShowRestoreDialog(false);
    } finally {
      setLoadingFiles(false);
    }
  }, [signedIn, error]);

  const handleRestore = async (file: CloudBackupFile) => {
    const ok = await confirm(
      `Restore backup from ${formatDate(file.modifiedTime)}?\n\nThis will replace all current data. A safety backup will download first.`,
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
      setShowRestoreDialog(false);
      success('Backup restored successfully!');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  return (
    <>
      <div className="data-action-card" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
        <div className="data-action-card__info" style={{ flex: '1 1 260px' }}>
          <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isEnabled
              ? <Cloud size={18} style={{ color: 'var(--accent-green)' }} />
              : <CloudOff size={18} />}
            Google Drive Sync
          </h3>

          {/* ── Connected state ── */}
          {isEnabled && (
            <>
              {email && (
                <p className="text-muted text-sm" style={{ marginBottom: '0.25rem' }}>
                  Signed in as <strong>{email}</strong>
                </p>
              )}
              {cloudSync.lastSyncISO && (
                <p className="text-muted text-sm">Last synced: {formatDate(cloudSync.lastSyncISO)}</p>
              )}
              {cloudSync.lastError && (
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-red, #f87171)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <AlertCircle size={13} /> {cloudSync.lastError}
                </p>
              )}
            </>
          )}

          {/* ── Not connected: explain what this does ── */}
          {!isEnabled && clientIdReady && (
            <p className="text-muted text-sm">
              Auto-sync encrypted backups to your Google Drive. Survives browser data clears and device loss.
              Uses a hidden app-only folder — your other Drive files are never accessed.
            </p>
          )}

          {/* ── Client ID section (only shown when env var not set) ── */}
          {!ENV_CLIENT_ID && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <KeyRound size={12} /> Google OAuth Client ID
              </p>
              <ClientIdForm
                savedId={savedClientId}
                onSave={handleSaveClientId}
                onClear={handleClearClientId}
              />
            </div>
          )}

          {/* ── Env var present: show read-only badge ── */}
          {ENV_CLIENT_ID && (
            <p className="text-muted text-sm" style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <KeyRound size={12} />
              Client ID configured by the app host.
            </p>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignSelf: 'flex-start' }}>
          {!isEnabled ? (
            clientIdReady && (
              <button className="btn btn-outline" onClick={handleSignIn} disabled={signingIn}>
                {signingIn ? 'Signing in…' : 'Connect Google Drive'}
              </button>
            )
          ) : (
            <>
              <button className="btn btn-outline" onClick={handleSyncNow} disabled={syncing}>
                <RefreshCw size={14} style={{ marginRight: '0.3rem' }} />
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
              <button className="btn btn-outline" onClick={handleOpenRestore}>
                <Download size={14} style={{ marginRight: '0.3rem' }} />
                Restore
              </button>
              <button className="btn btn-outline" onClick={handleSignOut} title="Sign out">
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {showRestoreDialog && (
        <RestoreDialog
          files={restoreFiles}
          onRestore={handleRestore}
          onClose={() => setShowRestoreDialog(false)}
          loading={loadingFiles}
        />
      )}
    </>
  );
};
