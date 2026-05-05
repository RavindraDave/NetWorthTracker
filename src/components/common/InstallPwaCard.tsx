import React from 'react';
import { Monitor } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

const isIos = (): boolean =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window as Window & { MSStream?: unknown }).MSStream;

export const InstallPwaCard: React.FC = () => {
  const { canInstall, promptInstall, isStandalone } = useInstallPrompt();

  // Already installed — don't show
  if (isStandalone) return null;

  if (isIos()) {
    return (
      <div className="data-action-card">
        <div className="data-action-card__info">
          <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Monitor size={18} /> Install as App (iOS)
          </h3>
          <p className="text-muted text-sm">
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> in Safari to install WealthPulse.
            Installed apps are auto-protected from browser data cleanup.
          </p>
        </div>
      </div>
    );
  }

  if (!canInstall) return null;

  return (
    <div className="data-action-card">
      <div className="data-action-card__info">
        <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Monitor size={18} /> Install as App
        </h3>
        <p className="text-muted text-sm">
          Installing WealthPulse auto-protects your data from browser storage cleanup — no configuration needed.
        </p>
      </div>
      <button className="btn btn-outline" onClick={promptInstall}>Install App</button>
    </div>
  );
};
