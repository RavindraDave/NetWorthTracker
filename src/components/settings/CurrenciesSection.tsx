import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { ALL_CURRENCIES } from '../../utils/currencies';
import { useApp } from '../../context/AppContext';

export const CurrenciesSection: React.FC = () => {
  const { preferences, updatePreferences } = useApp();
  const [currencySearch, setCurrencySearch] = useState('');

  if (!preferences) return null;

  const toggleCurrency = (code: string) => {
    const enabled = preferences.enabledCurrencies;
    if (code === preferences.baseCurrency) return;
    const next = enabled.includes(code)
      ? enabled.filter(c => c !== code)
      : [...enabled, code];
    updatePreferences({ enabledCurrencies: next });
  };

  const filteredCurrencies = ALL_CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const setAllVisibleCurrencies = (enable: boolean) => {
    const visibleCodes = filteredCurrencies.map(c => c.code);
    const next = enable
      ? Array.from(new Set([...preferences.enabledCurrencies, ...visibleCodes]))
      : preferences.enabledCurrencies.filter(c => c === preferences.baseCurrency || !visibleCodes.includes(c));
    updatePreferences({ enabledCurrencies: next });
  };

  return (
    <div className="wp-card settings-section">
      <h2 className="settings-h2">Currencies</h2>
      <p className="settings-hint" style={{ marginBottom: 14 }}>
        Toggle currencies to enable them in line items. Your base currency cannot be disabled.
      </p>
      <div className="currency-search-row">
        <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        <input
          type="text"
          className="settings-input currency-search-input"
          placeholder="Search currencies…"
          value={currencySearch}
          onChange={e => setCurrencySearch(e.target.value)}
          style={{ maxWidth: '100%' }}
        />
      </div>
      <div className="currency-bulk-actions">
        <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} onClick={() => setAllVisibleCurrencies(true)}>
          Enable {currencySearch ? 'shown' : 'all'}
        </button>
        <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} onClick={() => setAllVisibleCurrencies(false)}>
          Disable {currencySearch ? 'shown' : 'all'}
        </button>
      </div>
      <div className="currency-grid">
        {filteredCurrencies.map(c => {
          const enabled = preferences.enabledCurrencies.includes(c.code);
          const isBase  = c.code === preferences.baseCurrency;
          return (
            <button
              key={c.code}
              className={`currency-chip${enabled ? ' active' : ''}${isBase ? ' base' : ''}`}
              onClick={() => toggleCurrency(c.code)}
              disabled={isBase}
              title={c.name}
              aria-pressed={enabled}
            >
              <span className="currency-chip__code">{c.code}</span>
              <span className="currency-chip__symbol">{c.symbol}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
