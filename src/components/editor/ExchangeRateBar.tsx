import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fetchLiveRates } from '../../utils/exchangeRates';
import { useDecimalInput } from '../../hooks/useDecimalInput';
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
  if (ageDays < 1) {
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 1) return { isStale: false, label: 'Updated just now' };
    return { isStale: false, label: `Updated ${Math.floor(ageHours)}h ago` };
  }
  return { isStale: false, label: `Updated ${Math.floor(ageDays)}d ago` };
}

interface RateInputProps {
  currency: string;
  rate: number;
  onChange: (currency: string, rate: number) => void;
  needsManual: boolean;
}

const RateInput: React.FC<RateInputProps> = ({ currency, rate, onChange, needsManual }) => {
  const { inputProps } = useDecimalInput({
    value: rate,
    onCommit: (next) => { if (next > 0) onChange(currency, next); },
    precision: 5,
    min: 0,
  });

  return (
    <div className={`exchange-rate-input-group ${needsManual ? 'needs-manual' : ''}`}>
      <label className="exchange-rate-label">{currency}</label>
      <input
        {...inputProps}
        className="exchange-rate-input"
        placeholder="0.00000"
        aria-label={`${currency} exchange rate`}
      />
      {needsManual && (
        <span className="exchange-rate-manual-tag" title="Not available via API — enter manually">
          manual
        </span>
      )}
    </div>
  );
};

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

  const handleFetchRates = async () => {
    setFetchState('loading');
    setFetchMessage('');
    setUnavailable([]);
    try {
      const result = await fetchLiveRates(baseCurrency, displayCurrencies);

      const roundedRates: Record<string, number> = {};
      for (const [currency, rate] of Object.entries(result.rates)) {
        const rounded = Math.round(rate * 1e5) / 1e5;
        if (rounded > 0 && isFinite(rounded)) {
          roundedRates[currency] = rounded;
          onChange(currency, rounded);
        }
      }

      onRatesRefreshed(roundedRates, result.updatedAt);

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

      setTimeout(() => {
        setFetchState('idle');
        setFetchMessage('');
      }, 5000);
    } catch (err) {
      setFetchState('error');
      const msg = err instanceof Error ? err.message : 'Failed to fetch rates. Check your connection and try again.';
      setFetchMessage(msg);
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

      {fetchMessage && (
        <div className={`exchange-rate-bar__banner ${fetchState}`}>
          {fetchState === 'success' ? (
            <><Wifi size={13} />{fetchMessage}</>
          ) : (
            <><AlertTriangle size={13} />{fetchMessage}</>
          )}
        </div>
      )}

      {isStale && !fetchMessage && (
        <div className="exchange-rate-bar__banner stale-warning">
          <AlertTriangle size={13} />
          Rates may be outdated. Click <strong>Live Rates</strong> to auto-refresh from the market.
        </div>
      )}

      <div className="exchange-rate-bar__grid">
        {displayCurrencies.map(currency => (
          <RateInput
            key={currency}
            currency={currency}
            rate={rates[currency] ?? 0}
            onChange={onChange}
            needsManual={unavailable.includes(currency)}
          />
        ))}
      </div>
    </div>
  );
};
