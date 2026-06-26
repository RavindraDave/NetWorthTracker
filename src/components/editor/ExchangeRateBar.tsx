import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fetchAnchorRates } from '../../utils/exchangeRates';
import { RATE_ANCHOR } from '../../utils/calculations';
import { useDecimalInput } from '../../hooks/useDecimalInput';
import { resolveNumberLocale } from '../../utils/currencies';
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
  locale: string;
  disabled?: boolean;
  disabledTitle?: string;
}

const RateInput: React.FC<RateInputProps> = ({ currency, rate, onChange, needsManual, locale, disabled, disabledTitle }) => {
  const { inputProps } = useDecimalInput({
    value: rate,
    onCommit: (next) => { if (next > 0 && !disabled) onChange(currency, next); },
    precision: 5,
    min: 0,
    locale,
  });

  return (
    <div className={`exchange-rate-input-group ${needsManual ? 'needs-manual' : ''} ${disabled ? 'rate-input-disabled' : ''}`}>
      <label className="exchange-rate-label">{currency}</label>
      <input
        {...inputProps}
        className="exchange-rate-input"
        placeholder="0.00000"
        aria-label={`${currency} exchange rate`}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
      />
      {needsManual && !disabled && (
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
  const locale = resolveNumberLocale(preferences?.baseCurrency ?? 'INR', preferences?.numberFormat);

  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchMessage, setFetchMessage] = useState('');
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const displayCurrencies = enabledCurrencies.filter(c => c !== baseCurrency);
  const { isStale, label: staleLabel } = getStaleInfo(ratesLastUpdated);

  // "1 USD = baseAnchorRate baseCurrency". USD itself is implicitly 1.
  const baseAnchorRate = baseCurrency === RATE_ANCHOR ? 1 : (rates[baseCurrency] ?? 0);

  // True when the USD↔base anchor rate has not been set yet (blocks other manual edits).
  const missingBaseRate = baseCurrency !== RATE_ANCHOR && baseAnchorRate <= 0;

  // Convert anchor-relative stored rate to display rate "1 currency = X baseCurrency".
  const toDisplay = (currency: string): number => {
    if (currency === RATE_ANCHOR) return baseAnchorRate; // "1 USD = baseAnchorRate base"
    const anchorRate = rates[currency] ?? 0;
    if (anchorRate <= 0 || baseAnchorRate <= 0) return 0;
    return baseAnchorRate / anchorRate; // "1 currency = baseAnchorRate/anchorRate base"
  };

  // Convert display rate D ("1 currency = D baseCurrency") back to anchor-relative before storing.
  const handleDisplayRateCommit = (currency: string, displayRate: number) => {
    if (displayRate <= 0) return;
    if (currency === RATE_ANCHOR) {
      // "1 USD = D base" → store rates[base] = D
      onChange(baseCurrency, displayRate);
    } else if (baseCurrency === RATE_ANCHOR) {
      // "1 currency = D USD" → "1 USD = 1/D currency" → store rates[currency] = 1/D
      onChange(currency, 1 / displayRate);
    } else {
      // "1 currency = D base" → rates[currency] = baseAnchorRate / D
      // Guarded by disabled state — baseAnchorRate > 0 is guaranteed here
      onChange(currency, baseAnchorRate / displayRate);
    }
  };

  const handleFetchRates = async () => {
    setFetchState('loading');
    setFetchMessage('');
    setUnavailable([]);
    try {
      // Fetch anchor-relative rates (1 USD = X currency) for all needed currencies
      const targets = [...displayCurrencies, baseCurrency].filter(c => c !== RATE_ANCHOR);
      const result = await fetchAnchorRates(targets);

      const roundedRates: Record<string, number> = {};
      for (const [currency, rate] of Object.entries(result.rates)) {
        const rounded = Math.round(rate * 1e5) / 1e5;
        if (rounded > 0 && isFinite(rounded)) {
          roundedRates[currency] = rounded;
        }
      }

      // onRatesRefreshed handles all currencies atomically via functional update
      onRatesRefreshed(roundedRates, result.updatedAt);

      const sourceLabel = result.source === 'open.er-api'
        ? 'Open Exchange Rates'
        : 'Frankfurter (ECB)';

      const fetchedCount = Object.keys(roundedRates).length;
      const totalNeeded = targets.length;
      if (result.unavailable.length > 0) {
        setUnavailable(result.unavailable);
        setFetchMessage(
          `${fetchedCount}/${totalNeeded} rates updated via ${sourceLabel}. ` +
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

  const zeroRateCurrencies = displayCurrencies.filter(c => toDisplay(c) <= 0 && !missingBaseRate);

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

      {missingBaseRate && !fetchMessage && (
        <div className="exchange-rate-bar__banner error">
          <AlertTriangle size={13} />
          Enter the <strong>USD → {baseCurrency}</strong> rate first — it establishes the baseline for all other currencies. Or click <strong>Live Rates</strong>.
        </div>
      )}

      {!missingBaseRate && zeroRateCurrencies.length > 0 && !fetchMessage && (
        <div className="exchange-rate-bar__banner error">
          <AlertTriangle size={13} />
          <strong>{zeroRateCurrencies.join(', ')}</strong> {zeroRateCurrencies.length === 1 ? 'has' : 'have'} no exchange rate set — balances will be treated as {baseCurrency} (1:1). Enter rates manually or click <strong>Live Rates</strong>.
        </div>
      )}

      {fetchMessage && (
        <div className={`exchange-rate-bar__banner ${fetchState}`}>
          {fetchState === 'success' ? (
            <><Wifi size={13} />{fetchMessage}</>
          ) : (
            <><AlertTriangle size={13} />{fetchMessage}</>
          )}
        </div>
      )}

      {isStale && !fetchMessage && !missingBaseRate && zeroRateCurrencies.length === 0 && (
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
            rate={toDisplay(currency)}
            onChange={handleDisplayRateCommit}
            needsManual={unavailable.includes(currency)}
            locale={locale}
            disabled={missingBaseRate && currency !== RATE_ANCHOR}
            disabledTitle={`Enter the USD → ${baseCurrency} rate first`}
          />
        ))}
      </div>
    </div>
  );
};
