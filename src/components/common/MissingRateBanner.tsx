import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { getMissingRateCurrencies } from '../../utils/calculations';

const SNOOZE_DAYS = 1;
const SNOOZE_KEY = 'wealthpulse_missingRateSnoozeUntil';

function isSnoozed(): boolean {
  const val = localStorage.getItem(SNOOZE_KEY);
  if (!val) return false;
  return Date.now() < new Date(val).getTime();
}

export const MissingRateBanner: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const navigate = useNavigate();
  const [snoozed, setSnoozed] = useState(isSnoozed);

  if (!currentSnapshot || !preferences || snoozed) return null;

  const baseCurrency = preferences.baseCurrency || 'INR';
  const missingCurrencies = getMissingRateCurrencies(currentSnapshot, baseCurrency);

  if (missingCurrencies.length === 0) return null;

  const handleSnooze = () => {
    const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(SNOOZE_KEY, until);
    setSnoozed(true);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.65rem 1rem',
      marginBottom: '1rem',
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--accent-red, #dc2626) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--accent-red, #dc2626) 40%, transparent)',
      flexWrap: 'wrap',
    }}>
      <AlertTriangle size={16} style={{ color: 'var(--accent-red, #dc2626)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
        No exchange rate set for <strong>{missingCurrencies.join(', ')}</strong> — those amounts are being treated as 1:1 with {baseCurrency}, so net worth may be inaccurate.
      </span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className="btn btn-outline"
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
          onClick={() => navigate(`/editor/${currentSnapshot.id}`)}
        >
          Set rates
        </button>
        <button
          className="btn-icon"
          aria-label="Dismiss for 1 day"
          title="Dismiss for 1 day"
          onClick={handleSnooze}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
