import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calcCategoryTotal } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { Badge } from '../common/Badge';
import './LedgerActivity.css';

const CATEGORY_BADGE_VARIANTS: Record<string, 'positive' | 'blue' | 'purple' | 'orange' | 'default'> = {
  'Cash & Bank Accounts': 'positive',
  'Investments': 'blue',
  'Retirement (EPF/PPF/NPS/CPF)': 'purple',
  'Real Estate': 'orange',
};

const CATEGORY_ICONS: Record<string, string> = {
  wallet: '💰', 'trending-up': '📈', 'piggy-bank': '🏦', home: '🏠',
  coins: '🥇', car: '🚗', briefcase: '💼', globe: '🌍',
  building: '🏢', 'credit-card': '💳', 'file-text': '📄', 'alert-circle': '⚠️',
};

export const LedgerActivity: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const entries = useMemo(() => {
    if (!currentSnapshot) return [];
    return currentSnapshot.categories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: CATEGORY_ICONS[cat.icon] ?? '📂',
        type: cat.type,
        total: calcCategoryTotal(cat, baseCurrency, currentSnapshot.exchangeRates),
        itemCount: cat.items.length,
        badgeVariant: CATEGORY_BADGE_VARIANTS[cat.name] ?? 'default',
      }))
      .filter(e => e.total > 0 || e.itemCount > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [currentSnapshot, baseCurrency]);

  const month = currentSnapshot?.month
    ? new Date(currentSnapshot.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="ledger glass-card">
      <div className="chart-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h3 className="chart-title">Ledger Activity</h3>
          {month && <p className="chart-subtitle">{month} snapshot</p>}
        </div>
        <Badge variant="default">{entries.length} categories</Badge>
      </div>

      {entries.length === 0 ? (
        <div className="chart-empty">No data in this snapshot yet</div>
      ) : (
        <div className="ledger__list">
          {entries.map(entry => (
            <div key={entry.id} className="ledger__row">
              <div className="ledger__icon">{entry.icon}</div>
              <div className="ledger__info">
                <span className="ledger__name">{entry.name}</span>
                <span className="ledger__meta">{entry.itemCount} item{entry.itemCount !== 1 ? 's' : ''}</span>
              </div>
              <Badge variant={entry.type === 'asset' ? entry.badgeVariant : 'negative'}>
                {entry.type}
              </Badge>
              <div className={`ledger__amount ${entry.type === 'asset' ? 'positive' : 'negative'}`}>
                <CurrencyDisplay amount={entry.total} currency={baseCurrency} abbreviated />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
