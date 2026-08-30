import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';

export const PreferencesSection: React.FC = () => {
  const { preferences, updatePreferences } = useApp();
  const { success } = useToast();
  const [profileName, setProfileName] = useState(preferences?.profileName ?? '');
  useEffect(() => { setProfileName(preferences?.profileName ?? ''); }, [preferences?.profileName]);
  if (!preferences) return null;

  const themeOptions: { value: 'dark' | 'light' | 'system'; label: string; icon: React.ReactNode }[] = [
    { value: 'light',  label: 'Light',  icon: <Sun size={16} /> },
    { value: 'dark',   label: 'Dark',   icon: <Moon size={16} /> },
    { value: 'system', label: 'System', icon: <Monitor size={16} /> },
  ];

  return (
    <div className="wp-card settings-section">
      <h2 className="settings-h2">Preferences</h2>

      <div className="settings-row">
        <div>
          <label className="settings-label" htmlFor="base-currency">Base Currency</label>
          <p className="settings-hint">All amounts are converted and displayed in this currency.</p>
        </div>
        <select
          id="base-currency"
          className="settings-input"
          value={preferences.baseCurrency}
          onChange={e => { updatePreferences({ baseCurrency: e.target.value }); success(`Base currency changed to ${e.target.value}.`); }}
        >
          {preferences.enabledCurrencies.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div>
          <label className="settings-label" htmlFor="number-format">Number Format</label>
          <p className="settings-hint">How large numbers are grouped, e.g. {preferences.numberFormat === 'lakh' ? '12,34,567' : preferences.numberFormat === 'international' ? '1,234,567' : `auto (based on ${preferences.baseCurrency})`}.</p>
        </div>
        <select
          id="number-format"
          className="settings-input"
          value={preferences.numberFormat ?? 'auto'}
          onChange={e => updatePreferences({ numberFormat: e.target.value as 'auto' | 'lakh' | 'international' })}
        >
          <option value="auto">Auto (based on currency)</option>
          <option value="lakh">Lakh/Crore — India (12,34,567)</option>
          <option value="international">International (1,234,567)</option>
        </select>
      </div>

      <div className="settings-row">
        <div>
          <label className="settings-label">Theme</label>
          <p className="settings-hint">Choose how the app looks. System follows your OS setting.</p>
        </div>
        <div className="theme-toggle-group">
          {themeOptions.map(opt => (
            <button
              key={opt.value}
              className={`theme-toggle-btn${preferences.theme === opt.value ? ' active' : ''}`}
              onClick={() => updatePreferences({ theme: opt.value })}
              aria-pressed={preferences.theme === opt.value}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <div>
          <label className="settings-label" htmlFor="profile-name">Profile Name</label>
          <p className="settings-hint">Shown in the sidebar avatar.</p>
        </div>
        <input
          id="profile-name"
          className="settings-input"
          type="text"
          value={profileName}
          placeholder="Your name"
          onChange={e => setProfileName(e.target.value)}
          onBlur={() => { if (profileName !== (preferences.profileName ?? '')) updatePreferences({ profileName }); }}
        />
      </div>
    </div>
  );
};
