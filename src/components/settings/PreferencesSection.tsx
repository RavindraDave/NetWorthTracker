import React, { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchLiveRates } from '../../utils/exchangeRates';

export const PreferencesSection: React.FC = () => {
  const { preferences, updatePreferences, snapshots, saveSnapshot } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  if (!preferences) return null;

  const handleBaseCurrencyChange = async (newCurrency: string) => {
    if (newCurrency === preferences.baseCurrency) return;

    const count = snapshots.length;
    const confirmed = window.confirm(
      `Change base currency to ${newCurrency}?\n\n` +
      `Exchange rates across all ${count} snapshot${count !== 1 ? 's' : ''} will be ` +
      `refreshed to today's live rates in ${newCurrency}. Historical values will use ` +
      `current market rates rather than the rates at the time of recording.\n\n` +
      `Click OK to continue.`
    );
    if (!confirmed) return;

    const allCurrencies = Array.from(new Set(
      snapshots.flatMap(snap =>
        snap.categories.flatMap(cat => cat.items.map(i => i.currency))
      )
    )).filter(c => c !== newCurrency);

    setRefreshing(true);
    try {
      const result = await fetchLiveRates(newCurrency, allCurrencies);
      for (const snap of snapshots) {
        await saveSnapshot({ ...snap, exchangeRates: result.rates, ratesLastUpdated: result.updatedAt });
      }
      await updatePreferences({ baseCurrency: newCurrency });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      window.alert(
        `Base currency updated to ${newCurrency}, but live rates could not be fetched.\n\n` +
        `Error: ${msg}\n\n` +
        `Please refresh rates manually in the snapshot editor.`
      );
      await updatePreferences({ baseCurrency: newCurrency });
    } finally {
      setRefreshing(false);
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            id="base-currency"
            className="settings-input"
            value={preferences.baseCurrency}
            onChange={e => handleBaseCurrencyChange(e.target.value)}
            disabled={refreshing}
          >
            {preferences.enabledCurrencies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {refreshing && <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>Refreshing rates…</span>}
        </div>
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
          value={preferences.profileName ?? ''}
          placeholder="Your name"
          onChange={e => updatePreferences({ profileName: e.target.value })}
        />
      </div>
    </div>
  );
};
