import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ALL_CURRENCIES } from '../../utils/currencies';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';

export const CurrenciesSection: React.FC = () => {
  const { preferences, updatePreferences, snapshots } = useApp();
  const { confirm } = useToast();
  const [currencySearch, setCurrencySearch] = useState('');

  // Count line items using each currency across all snapshots, for a disable-usage warning.
  const usageMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const snap of snapshots) {
      for (const cat of snap.categories) {
        for (const item of cat.items) {
          map[item.currency] = (map[item.currency] ?? 0) + 1;
        }
      }
    }
    return map;
  }, [snapshots]);

  if (!preferences) return null;

  const toggleCurrency = async (code: string) => {
    const enabled = preferences.enabledCurrencies;
    if (code === preferences.baseCurrency) return;
    const disabling = enabled.includes(code);
    if (disabling && (usageMap[code] ?? 0) > 0) {
      const ok = await confirm(
        `${usageMap[code]} item${usageMap[code] === 1 ? '' : 's'} use ${code}. Disabling hides the rate editor for it but keeps existing data. Continue?`,
      );
      if (!ok) return;
    }
    const next = disabling
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
          const usageCount = usageMap[c.code] ?? 0;
          const title = isBase
            ? c.name
            : (enabled && usageCount > 0)
              ? `${c.name} — used by ${usageCount} item${usageCount === 1 ? '' : 's'}. Disabling hides the rate editor but keeps existing data.`
              : c.name;
          return (
            <button
              key={c.code}
              className={`currency-chip${enabled ? ' active' : ''}${isBase ? ' base' : ''}`}
              onClick={() => toggleCurrency(c.code)}
              disabled={isBase}
              title={title}
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
