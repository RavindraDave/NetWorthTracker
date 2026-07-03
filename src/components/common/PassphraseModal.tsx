import React, { useState } from 'react';
import { Lock, X, Eye, EyeOff } from 'lucide-react';
import { Modal } from './Modal';

interface PassphraseModalProps {
  mode: 'setup' | 'unlock';
  onSubmit: (passphrase: string) => void;
  onClose: () => void;
}

export const PassphraseModal: React.FC<PassphraseModalProps> = ({ mode, onSubmit, onClose }) => {
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
