import React, { useState, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, Download, LogOut, AlertCircle, ExternalLink, KeyRound, X, BookOpen, Lock, LockOpen, Eye, EyeOff, ArrowDownToLine } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { googleDriveProvider } from '../../utils/cloudSync/google/drive';
import { listBackups, downloadBackup } from '../../utils/cloudSync/google/drive';
import { CloudBackupFile } from '../../utils/cloudSync/types';
import { parseBackupJSON, exportToJSON, downloadFile } from '../../utils/importExport';
import { formatBytes } from '../../utils/storagePersist';
import { configureClientId, isClientIdConfigured } from '../../utils/cloudSync/google/gis';
import { setPassphrase, getPassphrase, hasPassphrase, isEncryptedEnvelope, decryptJSON } from '../../utils/cloudSync/encryption';
import type { CloudSyncConfig } from '../../types';

const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function maskClientId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// ── GCP Setup Guide modal ─────────────────────────────────────────────────────

const GCPSetupGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 500 }}>
      {label} <ExternalLink size={10} style={{ verticalAlign: 'middle' }} />
    </a>
  );

  const step = (n: number, title: string, body: React.ReactNode) => (
    <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.25rem' }}>
      <div style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
        background: 'var(--accent-soft)', color: 'var(--accent-text)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 700, marginTop: 2,
      }}>{n}</div>
      <div>
        <p style={{ margin: '0 0 0.4rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>{title}</p>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  );

  const code = (t: string) => (
    <code style={{ background: 'var(--surface-glass, rgba(0,0,0,0.15))', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-numeric)', fontSize: '0.8rem' }}>{t}</code>
  );

  return (
    <Modal onClose={onClose} aria-label="Google Cloud setup guide" contentStyle={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={16} style={{ color: 'var(--accent-text)' }} />
          Google Cloud Setup Guide
        </h3>
        <button onClick={onClose} className="btn-icon" aria-label="Close" style={{ color: 'var(--text-3)' }}>
          <X size={16} />
        </button>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
        One-time setup (~10 min). You only need this if you're self-hosting or running locally.
        The hosted app at wealthpulse.app has a Client ID pre-configured.
      </p>

      {step(1, 'Create a Google Cloud project', <>
        Open {link('https://console.cloud.google.com/projectcreate', 'console.cloud.google.com → New Project')}.
        Give it any name (e.g. <em>WealthPulse</em>) and click <strong>Create</strong>.
      </>)}

      {step(2, 'Enable the Google Drive API', <>
        In the left menu go to <strong>APIs &amp; Services → Library</strong>.
        Search for <strong>Google Drive API</strong>, click it, then click <strong>Enable</strong>.
        <br />Or use this {link('https://console.cloud.google.com/apis/library/drive.googleapis.com', 'direct link')}.
      </>)}

      {step(3, 'Configure the OAuth consent screen', <>
        Go to <strong>APIs &amp; Services → OAuth consent screen</strong>.<br />
        • User type: choose <strong>External</strong> → <strong>Create</strong>.<br />
        • Fill in <em>App name</em>, <em>User support email</em>, and <em>Developer contact email</em> — all three are required.<br />
        • On the <strong>Scopes</strong> step, click <strong>Add or remove scopes</strong> and search for{' '}
        {code('.../auth/drive.appdata')}. Select it → <strong>Update</strong>.<br />
        • On the <strong>Test users</strong> step, click <strong>Add users</strong> and add your own Google account email.
        Only listed test users can sign in while the app is unverified.<br />
        • Click <strong>Save and Continue</strong> through the remaining steps.
      </>)}

      {step(4, 'Create an OAuth Client ID', <>
        Go to <strong>APIs &amp; Services → Credentials</strong> → <strong>Create Credentials → OAuth client ID</strong>.<br />
        • Application type: <strong>Web application</strong>.<br />
        • Under <strong>Authorized JavaScript origins</strong> add every URL you'll open the app from:<br />
        <div style={{ margin: '0.4rem 0 0.4rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {code('http://localhost:3000')} — local dev / PM2 self-hosted<br />
          {code('https://your-app.vercel.app')} — your Vercel deployment URL<br />
          {code('https://your-custom-domain.com')} — if you use a custom domain
        </div>
        Click <strong>Create</strong>.
      </>)}

      {step(5, 'Add the Client ID to the app', <>
        The Client ID appears immediately in the popup — it looks like:<br />
        {code('123456789012-abcdefghij.apps.googleusercontent.com')}<br /><br />
        <strong>Option A — Paste it here (no rebuild needed):</strong><br />
        Close this guide, paste it into the <strong>Google OAuth Client ID</strong> field, click <strong>Save</strong>, then <strong>Connect Google Drive</strong>.<br /><br />
        <strong>Option B — Vercel environment variable:</strong><br />
        In Vercel: <strong>Settings → Environment Variables</strong>, add {code('VITE_GOOGLE_CLIENT_ID')} = your Client ID,
        then <strong>trigger a new deployment</strong>. Vite bakes env vars into the bundle at build time — the value won't appear until you redeploy.
      </>)}

      <div style={{
        background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)',
        borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--accent-text)' }}>Troubleshooting</strong><br />
        <strong>Error 400 — redirect_uri_mismatch:</strong> The URL you're using isn't in the Authorized JavaScript origins list. Add the exact URL (including port) and wait ~5 minutes for it to propagate.<br />
        <strong>Sign-in blocked / access denied:</strong> Your Google account isn't in the Test users list. Add it in OAuth consent screen → Test users tab.<br />
        <strong>Env var not showing after setting in Vercel:</strong> You must trigger a new Vercel deployment after adding/changing the env var.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
};

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
  onShowGuide: () => void;
}

const ClientIdForm: React.FC<ClientIdFormProps> = ({ savedId, onSave, onClear, onShowGuide }) => {
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
        <button
          onClick={onShowGuide}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent-text)', fontSize: '0.8rem', fontWeight: 500 }}
        >
          Setup guide <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
        </button>
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

// ── Passphrase modal ──────────────────────────────────────────────────────────

interface PassphraseModalProps {
  mode: 'setup' | 'unlock';
  onSubmit: (passphrase: string) => void;
  onClose: () => void;
}

const PassphraseModal: React.FC<PassphraseModalProps> = ({ mode, onSubmit, onClose }) => {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSetup = mode === 'setup';

  const handleSubmit = () => {
    if (isSetup && pass.length < 12) { setErr('Passphrase must be at least 12 characters.'); return; }
    if (isSetup && pass !== confirm) { setErr('Passphrases do not match.'); return; }
    if (!isSetup && pass.length === 0) { setErr('Enter your passphrase.'); return; }
    onSubmit(pass);
  };

  const inputStyle: React.CSSProperties = { flex: 1, fontSize: '0.85rem', fontFamily: 'monospace', letterSpacing: '0.05em' };

  return (
    <Modal onClose={onClose} aria-label={isSetup ? 'Set encryption passphrase' : 'Enter passphrase'}
      contentStyle={{ maxWidth: 440 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={16} style={{ color: 'var(--accent-text)' }} />
          {isSetup ? 'Set Encryption Passphrase' : 'Enter Passphrase'}
        </h3>
        <button onClick={onClose} className="btn-icon" aria-label="Close"><X size={16} /></button>
      </div>

      {isSetup ? (
        <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          Your backups will be encrypted with AES-256-GCM before uploading to Google Drive.
          This passphrase is stored in your browser session only — you will need to re-enter it each time you open the app.
          <strong style={{ display: 'block', marginTop: '0.4rem', color: 'var(--rose)' }}>
            If you forget this passphrase, your Drive backups cannot be recovered.
          </strong>
        </p>
      ) : (
        <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
          Enter your passphrase to decrypt this backup.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.3rem' }}>
            {isSetup ? 'Passphrase' : 'Passphrase'}
          </label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type={show ? 'text' : 'password'}
              className="line-item-input"
              style={inputStyle}
              value={pass}
              onChange={e => { setPass(e.target.value); setErr(null); }}
              onKeyDown={e => e.key === 'Enter' && !isSetup && handleSubmit()}
              placeholder={isSetup ? 'Min. 12 characters' : 'Passphrase'}
              autoComplete="new-password"
              autoFocus
            />
            <button className="btn-icon" onClick={() => setShow(s => !s)} type="button"
              aria-label={show ? 'Hide passphrase' : 'Show passphrase'} title={show ? 'Hide' : 'Show'}>
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {isSetup && (
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.3rem' }}>
              Confirm passphrase
            </label>
            <input
              type={show ? 'text' : 'password'}
              className="line-item-input"
              style={{ ...inputStyle, width: '100%' }}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setErr(null); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Repeat passphrase"
              autoComplete="new-password"
            />
          </div>
        )}

        {err && (
          <p style={{ fontSize: '0.8rem', color: 'var(--rose)', margin: 0 }}>{err}</p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={pass.length === 0 || (isSetup && confirm.length === 0)}
        >
          {isSetup ? 'Enable encryption' : 'Decrypt'}
        </button>
      </div>
    </Modal>
  );
};

// ── Main card ─────────────────────────────────────────────────────────────────

export const CloudSyncCard: React.FC = () => {
  const { preferences, updatePreferences, snapshots, goals, syncToCloud, pullFromCloud, restoreBackup } = useApp();
  const { success, error, confirm } = useToast();

  const [signingIn, setSigningIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreFiles, setRestoreFiles] = useState<CloudBackupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Encryption state
  const [passphraseModal, setPassphraseModal] = useState<'setup' | 'unlock' | null>(null);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<CloudBackupFile | null>(null);
  const [encPassphraseSet, setEncPassphraseSet] = useState(hasPassphrase);

  const cloudSync: CloudSyncConfig = preferences?.cloudSync ?? { provider: null, enabled: false };
  const isEnabled = cloudSync.enabled && cloudSync.provider === 'google';
  const signedIn = googleDriveProvider.isSignedIn();
  const email = googleDriveProvider.getEmail();
  const displayName = googleDriveProvider.getName();
  const avatarUrl = googleDriveProvider.getPicture();

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

  const handlePullNow = async () => {
    setPulling(true);
    try {
      await pullFromCloud();
      success('Pulled latest data from Google Drive.');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Pull failed. Try signing in again.');
    } finally {
      setPulling(false);
    }
  };

  const handleSyncModeChange = async (mode: 'merge' | 'override') => {
    await updatePreferences({ cloudSync: { ...cloudSync, syncMode: mode } });
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
      let json = await downloadBackup(file.id);
      if (isEncryptedEnvelope(json)) {
        const pass = getPassphrase();
        if (!pass) {
          setPendingRestoreFile(file);
          setPassphraseModal('unlock');
          return;
        }
        json = await decryptJSON(json, pass);
      }
      const data = parseBackupJSON(json);
      await restoreBackup(data);
      setShowRestoreDialog(false);
      success('Backup restored successfully!');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  const handlePassphraseSubmit = async (passphrase: string) => {
    setPassphrase(passphrase);
    setEncPassphraseSet(true);
    const mode = passphraseModal;
    setPassphraseModal(null);

    if (mode === 'setup') {
      await updatePreferences({ cloudSync: { ...cloudSync, encryptionEnabled: true } });
      // Immediately replace the canonical Drive file with an encrypted one, so we
      // never leave a plaintext backup on Drive while prefs claim encryption is on.
      try {
        await syncToCloud();
        success('Encryption enabled — an encrypted backup has been uploaded.');
      } catch {
        success('Encryption enabled. Your next sync will upload an encrypted backup.');
      }
    } else if (mode === 'unlock' && pendingRestoreFile) {
      const file = pendingRestoreFile;
      setPendingRestoreFile(null);
      try {
        const raw = await downloadBackup(file.id);
        const json = await decryptJSON(raw, passphrase);
        const data = parseBackupJSON(json);
        await restoreBackup(data);
        setShowRestoreDialog(false);
        success('Backup restored successfully!');
      } catch (err) {
        error(err instanceof Error ? err.message : 'Restore failed — check your passphrase.');
        setPassphrase(null);
        setEncPassphraseSet(false);
      }
    }
  };

  const handleDisableEncryption = async () => {
    const ok = await confirm(
      'Disable encryption? Future syncs will upload unencrypted backups. Existing encrypted backups on Drive remain encrypted.',
    );
    if (!ok) return;
    setPassphrase(null);
    setEncPassphraseSet(false);
    await updatePreferences({ cloudSync: { ...cloudSync, encryptionEnabled: false } });
    success('Encryption disabled.');
  };

  const handleChangePassphrase = () => {
    setPassphraseModal('setup');
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
              {(displayName || email) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.4rem 0' }}>
                  {/* Avatar: photo or initials fallback */}
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName ?? email ?? 'Google account'}
                      referrerPolicy="no-referrer"
                      style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--accent-soft)', color: 'var(--accent-text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-display)',
                    }}>
                      {(displayName || email || 'G').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    {displayName && (
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3 }}>
                        {displayName}
                      </p>
                    )}
                    {email && (
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email}
                      </p>
                    )}
                  </div>
                </div>
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
                onShowGuide={() => setShowSetupGuide(true)}
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

          {/* ── Sync mode (only when Drive is connected) ── */}
          {isEnabled && (
            <div style={{ marginTop: '0.85rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Pull behaviour
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['merge', 'override'] as const).map(m => (
                  <button
                    key={m}
                    className={`btn btn-outline${(cloudSync.syncMode ?? 'merge') === m ? ' btn-outline--active' : ''}`}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', opacity: (cloudSync.syncMode ?? 'merge') === m ? 1 : 0.6 }}
                    onClick={() => handleSyncModeChange(m)}
                    aria-pressed={(cloudSync.syncMode ?? 'merge') === m}
                  >
                    {m === 'merge' ? 'Merge (smart)' : 'Override (remote wins)'}
                  </button>
                ))}
              </div>
              <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
                {(cloudSync.syncMode ?? 'merge') === 'merge'
                  ? 'On pull: combine both sides. Conflicts shown for manual resolution.'
                  : 'On pull: replace all local data with Drive version (destructive).'}
              </p>
            </div>
          )}

          {/* ── Encryption section (only when Drive is connected) ── */}
          {isEnabled && (
            <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                {cloudSync.encryptionEnabled
                  ? <Lock size={12} style={{ color: 'var(--accent-green)' }} />
                  : <LockOpen size={12} />}
                Backup Encryption
              </p>
              {cloudSync.encryptionEnabled ? (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
                    AES-256 encryption enabled.{' '}
                    {encPassphraseSet
                      ? <span style={{ color: 'var(--accent-green)' }}>Passphrase active this session.</span>
                      : <span style={{ color: 'var(--rose)' }}>Passphrase required — enter it to sync or restore.</span>}
                  </span>
                  {!encPassphraseSet && (
                    <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      onClick={() => setPassphraseModal('unlock')}>
                      Enter passphrase
                    </button>
                  )}
                  {encPassphraseSet && (
                    <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      onClick={handleChangePassphrase}>
                      Change passphrase
                    </button>
                  )}
                  <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    onClick={handleDisableEncryption}>
                    Disable
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0, flex: '1 1 200px' }}>
                    Encrypt backups with AES-256-GCM before uploading. Requires a passphrase on each session.
                  </p>
                  <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', flexShrink: 0 }}
                    onClick={() => setPassphraseModal('setup')}>
                    Enable encryption
                  </button>
                </div>
              )}
            </div>
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
              <button className="btn btn-outline" onClick={handleSyncNow} disabled={syncing || pulling} title="Push local data to Drive">
                <RefreshCw size={14} style={{ marginRight: '0.3rem' }} />
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
              <button className="btn btn-outline" onClick={handlePullNow} disabled={pulling || syncing} title="Pull latest data from Drive">
                <ArrowDownToLine size={14} style={{ marginRight: '0.3rem' }} />
                {pulling ? 'Pulling…' : 'Pull'}
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

      {showSetupGuide && <GCPSetupGuide onClose={() => setShowSetupGuide(false)} />}

      {showRestoreDialog && (
        <RestoreDialog
          files={restoreFiles}
          onRestore={handleRestore}
          onClose={() => setShowRestoreDialog(false)}
          loading={loadingFiles}
        />
      )}

      {passphraseModal && (
        <PassphraseModal
          mode={passphraseModal}
          onSubmit={handlePassphraseSubmit}
          onClose={() => { setPassphraseModal(null); setPendingRestoreFile(null); }}
        />
      )}
    </>
  );
};
