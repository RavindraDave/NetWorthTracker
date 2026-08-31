import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Fingerprint, ShieldQuestion, Eye, EyeOff, Hourglass } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  unlockWithPasskey as passkeyUnlock,
  recoverWithCode,
  recoverWithGoogle,
} from '../../utils/appLock';
import { isLockedOut, secondsRemaining } from '../../utils/appLockThrottle';
import './AppLockScreen.css';

type Mode = 'passphrase' | 'recover-code' | 'recover-google';

/**
 * Full-screen gate shown when the app lock is enabled but no key is in session.
 * Nothing sensitive is in memory while this is mounted.
 */
export const AppLockScreen: React.FC = () => {
  const { preferences, unlockWithPassphrase, unlockWithDEK } = useApp();
  const lock = preferences?.appLock;

  const [mode, setMode] = useState<Mode>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, forceTick] = useState(0);

  // A local, per-device attempt lockout — see `appLockThrottle.ts` for what
  // this does and does not defend against. Ticks the countdown once a second
  // while active, and self-stops once it expires rather than ticking forever.
  //
  // Deliberately depends only on `lockedUntilISO`, not the whole `lock`
  // object: `lock` is a new object reference on every `preferences` update
  // (e.g. other App Lock settings changing), which would tear down and
  // restart this interval far more often than the one thing it actually
  // needs to react to — a new lockout deadline being set.
  useEffect(() => {
    const id = setInterval(() => {
      if (!isLockedOut(lock)) { clearInterval(id); return; }
      forceTick(t => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [lock?.lockedUntilISO]); // eslint-disable-line react-hooks/exhaustive-deps

  const lockedOut = isLockedOut(lock);
  const remaining = secondsRemaining(lock);

  const handlePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || lockedOut) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await unlockWithPassphrase(passphrase);
      if (!ok) setError('Incorrect passphrase. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handlePasskey = async () => {
    setBusy(true);
    setError(null);
    try {
      const dek = await passkeyUnlock();
      if (!dek) setError('Passkey did not match. Try your passphrase.');
      else await unlockWithDEK(dek);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey unlock failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRecoverCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const dek = await recoverWithCode(code);
      if (!dek) setError('That recovery code did not work. Check it and try again.');
      else await unlockWithDEK(dek);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRecoverGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const dek = await recoverWithGoogle();
      if (!dek) setError('No Google recovery copy was found for this account.');
      else await unlockWithDEK(dek);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google recovery failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="applock-overlay">
      <div className="applock-card glass-card">
        <div className="applock-icon"><Lock size={26} /></div>
        <h1 className="applock-title">WealthPulse is locked</h1>
        <p className="applock-sub">
          Your financial data on this device is encrypted. Unlock to continue.
        </p>

        {mode === 'passphrase' && (
          <form onSubmit={handlePassphrase} className="applock-form">
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type={showPassphrase ? 'text' : 'password'}
                autoFocus
                className="line-item-input applock-input"
                style={{ flex: 1 }}
                placeholder="Passphrase"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                disabled={busy || lockedOut}
                aria-label="Passphrase"
              />
              <button type="button" className="btn-icon" onClick={() => setShowPassphrase(s => !s)}
                aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'} title={showPassphrase ? 'Hide' : 'Show'}>
                {showPassphrase ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button type="submit" className="btn btn-primary applock-btn" disabled={busy || lockedOut || !passphrase}>
              {lockedOut ? `Try again in ${remaining}s` : busy ? 'Unlocking…' : 'Unlock'}
            </button>

            {lockedOut && (
              <p className="applock-hint" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Hourglass size={12} /> Too many attempts. This is a per-device pause, not extra security against someone with direct access to this device's files.
              </p>
            )}

            {lock?.webauthnEnabled && (
              <button type="button" className="btn btn-outline applock-btn" onClick={handlePasskey} disabled={busy}>
                <Fingerprint size={16} /> Unlock with passkey
              </button>
            )}
          </form>
        )}

        {mode === 'recover-code' && (
          <form onSubmit={handleRecoverCode} className="applock-form">
            <input
              type="text"
              autoFocus
              className="line-item-input applock-input"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={busy}
              aria-label="Recovery code"
            />
            <button type="submit" className="btn btn-primary applock-btn" disabled={busy || !code}>
              {busy ? 'Recovering…' : 'Recover access'}
            </button>
            <p className="applock-hint">After recovering, set a new passphrase in Settings → App Lock.</p>
          </form>
        )}

        {mode === 'recover-google' && (
          <div className="applock-form">
            <p className="applock-hint" style={{ marginTop: 0 }}>
              You'll be asked to sign in to Google to retrieve your key. This works only if you
              turned on Google recovery.
            </p>
            <button type="button" className="btn btn-primary applock-btn" onClick={handleRecoverGoogle} disabled={busy}>
              {busy ? 'Connecting…' : 'Recover via Google'}
            </button>
          </div>
        )}

        {error && <p className="applock-error" role="alert">{error}</p>}

        <div className="applock-links">
          {mode !== 'passphrase' && (
            <button type="button" className="applock-link" onClick={() => { setMode('passphrase'); setError(null); }}>
              ← Back to passphrase
            </button>
          )}
          {mode === 'passphrase' && lock?.recovery.code && (
            <button type="button" className="applock-link" onClick={() => { setMode('recover-code'); setError(null); }}>
              <KeyRound size={13} /> Use a recovery code
            </button>
          )}
          {mode === 'passphrase' && lock?.recovery.googleEscrow && (
            <button type="button" className="applock-link" onClick={() => { setMode('recover-google'); setError(null); }}>
              <ShieldQuestion size={13} /> Recover via Google
            </button>
          )}
          {mode === 'passphrase' && !lock?.recovery.code && !lock?.recovery.googleEscrow && !lock?.webauthnEnabled && (
            <p className="applock-hint">
              No recovery method was set up for this lock. If you've forgotten your passphrase,
              this device's data cannot be unlocked.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
