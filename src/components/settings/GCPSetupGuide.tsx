import React from 'react';
import { BookOpen, ExternalLink, X } from 'lucide-react';
import { Modal } from '../common/Modal';

export const GCPSetupGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => {
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
