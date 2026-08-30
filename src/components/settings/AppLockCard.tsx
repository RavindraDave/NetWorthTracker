import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Fingerprint, AlertTriangle, Copy, X, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { Banner } from '../common/Banner';
import { useToast } from '../common/Toast';
import { isPlatformAuthenticatorAvailable } from '../../utils/webauthn';
import { isClientIdConfigured } from '../../utils/cloudSync/google/gis';

const AUTO_LOCK_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 0, label: 'Only when tab closes' },
];

export const AppLockCard: React.FC = () => {
  const {
    preferences, isLocked,
    enableAppLock, disableAppLock, changeAppLockPassphrase,
    setRecoveryCode, setGoogleEscrow, setPasskey, updatePreferences,
  } = useApp();
  const { success, error: toastError, confirm } = useToast();
  const lock = preferences?.appLock;
  const enabled = !!lock?.enabled;

  const [passkeySupported, setPasskeySupported] = useState(false);
  const [busy, setBusy] = useState(false);

  // Modals
  const [setupOpen, setSetupOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [recoveryCode, setRecoveryCodeValue] = useState<string | null>(null);

  useEffect(() => { isPlatformAuthenticatorAvailable().then(setPasskeySupported); }, []);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) success(ok);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRecoveryCode = async (next: boolean) => {
    if (!next) {
      const ok = await confirm(
        'Remove your recovery code? If you forget your passphrase afterward, your data cannot be recovered.',
        'destructive',
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const code = await setRecoveryCode(next);
      if (next && code) setRecoveryCodeValue(code);
      else if (!next) {
        const otherRecoveryLeft = lock?.recovery.googleEscrow || lock?.webauthnEnabled;
        success(otherRecoveryLeft ? 'Recovery code removed.' : 'Recovery code removed — no recovery method remains.');
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not update recovery code.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleGoogleEscrow = async (next: boolean) => {
    if (!next) {
      const ok = await confirm(
        'Turn off Google recovery? If you forget your passphrase afterward, your data cannot be recovered.',
        'destructive',
      );
      if (!ok) return;
    }
    const otherRecoveryLeft = lock?.recovery.code || lock?.webauthnEnabled;
    run(() => setGoogleEscrow(next), next ? 'Google recovery on.' : (otherRecoveryLeft ? 'Google recovery off.' : 'Google recovery off — no recovery method remains.'));
  };

  const handleTogglePasskey = async (next: boolean) => {
    if (!next) {
      const ok = await confirm(
        'Remove passkey unlock? If you forget your passphrase afterward, your data cannot be recovered.',
        'destructive',
      );
      if (!ok) return;
    }
    const otherRecoveryLeft = lock?.recovery.code || lock?.recovery.googleEscrow;
    run(() => setPasskey(next), next ? 'Passkey added.' : (otherRecoveryLeft ? 'Passkey removed.' : 'Passkey removed — no recovery method remains.'));
  };

  return (
    <div className="data-action-card" style={{ flexWrap: 'wrap', gap: '1rem' }}>
      <div className="data-action-card__info" style={{ flex: '1 1 260px' }}>
        <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={18} /> App Lock
        </h3>
        <p className="text-muted text-sm">
          Encrypt your data on this device and require a passphrase to open the app. Best for
          shared or family computers. {enabled
            ? <strong style={{ color: 'var(--green, #4ade80)' }}>Currently on.</strong>
            : 'Off by default.'}
        </p>

        {!enabled && (
          <>
            <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.6rem', display: 'flex', gap: '0.4rem' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber, #fbbf24)' }} />
              Back up your data (export or Google Drive) before enabling. If you forget your
              passphrase and have no recovery method, your data cannot be recovered.
            </p>
            <button className="btn btn-primary" style={{ marginTop: '0.85rem' }} disabled={busy} onClick={() => setSetupOpen(true)}>
              Enable App Lock
            </button>
          </>
        )}

        {enabled && (
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!lock?.recovery.code && !lock?.recovery.googleEscrow && !lock?.webauthnEnabled && (
              <Banner variant="warning" icon={<AlertTriangle size={16} />}>
                No recovery method is set up. If you forget your passphrase, your data cannot be recovered.
              </Banner>
            )}

            {/* Auto-lock */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Auto-lock</label>
              <select
                className="line-item-input"
                style={{ padding: '0.4rem 0.6rem', maxWidth: 240 }}
                value={lock?.autoLockMinutes ?? 15}
                disabled={busy}
                onChange={e => updatePreferences({ appLock: { ...lock!, autoLockMinutes: Number(e.target.value) } })}
              >
                {AUTO_LOCK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Recovery code */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem' }}>
              <input type="checkbox" checked={!!lock?.recovery.code} disabled={busy} onChange={e => handleToggleRecoveryCode(e.target.checked)} />
              <span>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><KeyRound size={13} /> Recovery code</strong>
                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                  A one-time code that can restore access if you forget the passphrase. Fully private —
                  keep it somewhere safe.
                </span>
              </span>
            </label>

            {/* Google escrow */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem' }}>
              <input type="checkbox" checked={!!lock?.recovery.googleEscrow} disabled={busy}
                onChange={e => handleToggleGoogleEscrow(e.target.checked)} />
              <span>
                <strong>Recover via Google</strong>
                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                  Convenient — no code to keep — but <strong>not zero-knowledge</strong>: anyone with
                  access to your Google account could decrypt this data.
                  {!isClientIdConfigured() && !lock?.recovery.googleEscrow && (
                    <span style={{ display: 'block', marginTop: 2 }}>Requires Google Drive connected in Settings → Cloud Sync first.</span>
                  )}
                </span>
              </span>
            </label>

            {/* Passkey */}
            {(passkeySupported || lock?.webauthnEnabled) && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem' }}>
                <input type="checkbox" checked={!!lock?.webauthnEnabled} disabled={busy}
                  onChange={e => handleTogglePasskey(e.target.checked)} />
                <span>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Fingerprint size={13} /> Unlock with passkey</strong>
                  <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                    Use Touch ID / Windows Hello on this device. Passphrase still works as a fallback.
                  </span>
                </span>
              </label>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" disabled={busy || isLocked} onClick={() => setChangeOpen(true)}>Change passphrase</button>
              <button className="btn btn-outline" style={{ color: 'var(--red, #f87171)' }} disabled={busy}
                onClick={async () => {
                  const ok = await confirm(
                    'Turn off App Lock? Your data will be decrypted and stored as plaintext on this device.',
                    'destructive',
                  );
                  if (ok) run(() => disableAppLock(), 'App lock disabled — data is now unencrypted.');
                }}>
                Turn off
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ alignSelf: 'flex-start', color: enabled ? 'var(--green, #4ade80)' : 'var(--text-3)' }}>
        <ShieldCheck size={20} />
      </div>

      {setupOpen && (
        <SetupModal
          busy={busy}
          onClose={() => setSetupOpen(false)}
          onConfirm={async (pp) => { await run(() => enableAppLock(pp), 'App lock enabled.'); setSetupOpen(false); }}
        />
      )}

      {changeOpen && (
        <SetupModal
          title="Change passphrase"
          cta="Update"
          busy={busy}
          onClose={() => setChangeOpen(false)}
          onConfirm={async (pp) => { await run(() => changeAppLockPassphrase(pp), 'Passphrase updated.'); setChangeOpen(false); }}
        />
      )}

      {recoveryCode && (
        <RecoveryCodeModal code={recoveryCode} onClose={() => { setRecoveryCodeValue(null); success('Recovery code is now active.'); }} />
      )}
    </div>
  );
};

// ── Setup / change passphrase modal ───────────────────────────────────────────
const SetupModal: React.FC<{
  title?: string;
  cta?: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (passphrase: string) => Promise<void>;
}> = ({ title = 'Enable App Lock', cta = 'Enable', busy, onClose, onConfirm }) => {
  const [pp, setPp] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const mismatch = confirm.length > 0 && pp !== confirm;
  const tooShort = pp.length > 0 && pp.length < 8;
  const valid = pp.length >= 8 && pp === confirm;

  return (
    <Modal onClose={onClose} contentStyle={{ maxWidth: 420, padding: '1.5rem' }} aria-label={title}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
        <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <p className="text-muted text-sm" style={{ marginTop: 0 }}>
        Use at least 8 characters. There is no way to reset this except your recovery methods.
        This is separate from your Cloud Sync encryption passphrase, if you've set one.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input type={show ? 'text' : 'password'} autoFocus className="line-item-input" placeholder="Passphrase"
            style={{ flex: 1 }} value={pp} onChange={e => setPp(e.target.value)} disabled={busy} aria-label="Passphrase" />
          <button className="btn-icon" type="button" onClick={() => setShow(s => !s)}
            aria-label={show ? 'Hide passphrase' : 'Show passphrase'} title={show ? 'Hide' : 'Show'}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <input type={show ? 'text' : 'password'} className="line-item-input" placeholder="Confirm passphrase"
          value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} aria-label="Confirm passphrase" />
        {tooShort && <p style={{ fontSize: '0.75rem', color: 'var(--amber, #fbbf24)', margin: 0 }}>At least 8 characters.</p>}
        {mismatch && <p style={{ fontSize: '0.75rem', color: 'var(--red, #f87171)', margin: 0 }}>Passphrases don't match.</p>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
        <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" disabled={!valid || busy} onClick={() => onConfirm(pp)}>
          {busy ? 'Working…' : cta}
        </button>
      </div>
    </Modal>
  );
};

// ── Recovery code reveal modal ────────────────────────────────────────────────
const RecoveryCodeModal: React.FC<{ code: string; onClose: () => void }> = ({ code, onClose }) => {
  const { success } = useToast();
  const copy = async () => { try { await navigator.clipboard.writeText(code); success('Copied to clipboard.'); } catch { /* ignore */ } };
  return (
    <Modal onClose={onClose} contentStyle={{ maxWidth: 420, padding: '1.5rem' }} aria-label="Recovery code">
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <KeyRound size={16} /> Save your recovery code
      </h3>
      <p className="text-muted text-sm" style={{ marginTop: 0 }}>
        This is shown <strong>once</strong>. Store it somewhere safe — it's the only way to recover
        your data if you forget your passphrase (besides any other recovery you enabled).
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0', padding: '0.75rem 1rem',
        background: 'var(--bg-2, #11151d)', borderRadius: 'var(--radius, 10px)', fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.06em', justifyContent: 'space-between' }}>
        <span style={{ wordBreak: 'break-all' }}>{code}</span>
        <button className="btn-icon" onClick={copy} aria-label="Copy code"><Copy size={16} /></button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={onClose}>I've saved it</button>
      </div>
    </Modal>
  );
};
