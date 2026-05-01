import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fetchLiveRates } from '../../utils/exchangeRates';
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, Wifi } from 'lucide-react';
import './ExchangeRateBar.css';

type FetchState = 'idle' | 'loading' | 'success' | 'error';

interface ExchangeRateBarProps {
  rates: Record<string, number>;
  ratesLastUpdated?: string;
  onChange: (currency: string, rate: number) => void;
  onRatesRefreshed: (rates: Record<string, number>, updatedAt: string) => void;
}

function getStaleInfo(ratesLastUpdated?: string): { isStale: boolean; label: string } {
  if (!ratesLastUpdated) {
    return { isStale: true, label: 'Rates not updated — using defaults' };
  }
  const ageMs = Date.now() - new Date(ratesLastUpdated).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > 30) {
    return { isStale: true, label: `Rates are ${Math.floor(ageDays)} days old` };
  }
  // Format nice label
  if (ageDays < 1) {
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 1) return { isStale: false, label: 'Updated just now' };
    return { isStale: false, label: `Updated ${Math.floor(ageHours)}h ago` };
  }
  return { isStale: false, label: `Updated ${Math.floor(ageDays)}d ago` };
}

export const ExchangeRateBar: React.FC<ExchangeRateBarProps> = ({
  rates,
  ratesLastUpdated,
  onChange,
  onRatesRefreshed,
}) => {
  const { preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const enabledCurrencies = preferences?.enabledCurrencies || ['INR', 'USD', 'EUR', 'GBP', 'SGD'];

  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchMessage, setFetchMessage] = useState('');
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const displayCurrencies = enabledCurrencies.filter(c => c !== baseCurrency);
  const { isStale, label: staleLabel } = getStaleInfo(ratesLastUpdated);

  const handleRateChange = (currency: string, value: string) => {
    const rate = parseFloat(value);
    if (!isNaN(rate) && rate > 0) {
      onChange(currency, rate);
    }
  };

  const handleFetchRates = async () => {
    setFetchState('loading');
    setFetchMessage('');
    setUnavailable([]);
    try {
      const result = await fetchLiveRates(baseCurrency, displayCurrencies);

      // Apply fetched rates
      for (const [currency, rate] of Object.entries(result.rates)) {
        onChange(currency, parseFloat(rate.toFixed(4)));
      }

      onRatesRefreshed(result.rates, result.updatedAt);

      const sourceLabel = result.source === 'open.er-api'
        ? 'Open Exchange Rates'
        : 'Frankfurter (ECB)';

      if (result.unavailable.length > 0) {
        setUnavailable(result.unavailable);
        setFetchMessage(
          `${displayCurrencies.length - result.unavailable.length}/${displayCurrencies.length} rates updated via ${sourceLabel}. ` +
          `${result.unavailable.join(', ')} unavailable — please set manually.`
        );
      } else {
        setFetchMessage(`All rates updated via ${sourceLabel}`);
      }
      setFetchState('success');

      // Reset to idle after 5s
      setTimeout(() => {
        setFetchState('idle');
        setFetchMessage('');
      }, 5000);
    } catch (err: any) {
      setFetchState('error');
      setFetchMessage(err.message || 'Failed to fetch rates. Check your connection and try again.');
    }
  };

  if (displayCurrencies.length === 0) return null;

  return (
    <div className="exchange-rate-bar glass-card">
      <div className="exchange-rate-bar__header">
        <div className="exchange-rate-bar__title-group">
          <span className="exchange-rate-bar__title">
            Exchange Rates (1 Unit → {baseCurrency})
          </span>
          {/* Stale / last-updated badge */}
          <span className={`exchange-rate-bar__freshness ${isStale ? 'stale' : 'fresh'}`}>
            <Clock size={11} />
            {staleLabel}
          </span>
        </div>

        <button
          className={`exchange-rate-bar__refresh-btn ${fetchState}`}
          onClick={handleFetchRates}
          disabled={fetchState === 'loading'}
          title={fetchState === 'loading' ? 'Fetching live rates…' : 'Fetch live rates'}
        >
          {fetchState === 'loading' ? (
            <RefreshCw size={14} className="spinning" />
          ) : fetchState === 'success' ? (
            <CheckCircle2 size={14} />
          ) : fetchState === 'error' ? (
            <AlertTriangle size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          <span>
            {fetchState === 'loading'
              ? 'Fetching…'
              : fetchState === 'success'
              ? 'Updated!'
              : fetchState === 'error'
              ? 'Retry'
              : 'Live Rates'}
          </span>
        </button>
      </div>

      {/* Status banner */}
      {fetchMessage && (
        <div className={`exchange-rate-bar__banner ${fetchState}`}>
          {fetchState === 'success' ? (
            <>
              <Wifi size={13} />
              {fetchMessage}
            </>
          ) : (
            <>
              <AlertTriangle size={13} />
              {fetchMessage}
            </>
          )}
        </div>
      )}

      {/* Stale warning (shown when no status banner) */}
      {isStale && !fetchMessage && (
        <div className="exchange-rate-bar__banner stale-warning">
          <AlertTriangle size={13} />
          Rates may be outdated. Click <strong>Live Rates</strong> to auto-refresh from the market.
        </div>
      )}

      <div className="exchange-rate-bar__grid">
        {displayCurrencies.map(currency => (
          <div
            key={currency}
            className={`exchange-rate-input-group ${unavailable.includes(currency) ? 'needs-manual' : ''}`}
          >
            <label className="exchange-rate-label">{currency}</label>
            <input
              type="number"
              className="exchange-rate-input"
              value={rates[currency] ?? ''}
              onChange={e => handleRateChange(currency, e.target.value)}
              step="0.01"
              min="0"
              placeholder="0.00"
            />
            {unavailable.includes(currency) && (
              <span className="exchange-rate-manual-tag" title="Not available via API — enter manually">
                manual
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
