import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { getMissingRateCurrencies } from '../../utils/calculations';
import { Banner } from './Banner';
import { TEXT } from './theme';

const SNOOZE_DAYS = 1;

function isSnoozed(snoozeUntil: string | undefined): boolean {
  if (!snoozeUntil) return false;
  return Date.now() < new Date(snoozeUntil).getTime();
}

export const MissingRateBanner: React.FC = () => {
  const { currentSnapshot, preferences, updatePreferences } = useApp();
  const navigate = useNavigate();

  if (!currentSnapshot || !preferences || isSnoozed(preferences.missingRateSnoozeUntil)) return null;

  const baseCurrency = preferences.baseCurrency || 'INR';
  const missingCurrencies = getMissingRateCurrencies(currentSnapshot, baseCurrency);

  if (missingCurrencies.length === 0) return null;

  const handleSnooze = async () => {
    const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await updatePreferences({ missingRateSnoozeUntil: until });
  };

  return (
    <Banner
      variant="error"
      icon={<AlertTriangle size={16} />}
      actions={
        <>
          <button
            className="btn btn-outline"
            style={{ fontSize: TEXT.base, padding: '0.3rem 0.7rem' }}
            onClick={() => navigate(`/editor/${currentSnapshot.id}`)}
          >
            Set rates
          </button>
          <button className="btn-icon" aria-label="Dismiss for 1 day" title="Dismiss for 1 day" onClick={handleSnooze}>
            <X size={14} />
          </button>
        </>
      }
    >
      No exchange rate set for <strong>{missingCurrencies.join(', ')}</strong> — those amounts are being treated as 1:1 with {baseCurrency}, so net worth may be inaccurate.
    </Banner>
  );
};
