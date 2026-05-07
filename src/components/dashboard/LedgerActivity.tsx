import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calcCategoryTotal } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import './LedgerActivity.css';

const ICON_MAP: Record<string, string> = {
  wallet: '💰', 'trending-up': '📈', 'piggy-bank': '🏦', home: '🏠',
  coins: '🥇', car: '🚗', briefcase: '💼', globe: '🌍',
  building: '🏢', 'credit-card': '💳', 'file-text': '📄', 'alert-circle': '⚠️',
};

function getCategoryAccent(name: string, type: string): 'accent' | 'amber' | 'rose' {
  if (type === 'liability') return 'rose';
  const lname = name.toLowerCase();
  if (lname.includes('invest') || lname.includes('stock') || lname.includes('fund')) return 'accent';
  if (lname.includes('retir') || lname.includes('epf') || lname.includes('ppf') || lname.includes('nps') || lname.includes('cpf')) return 'amber';
  return 'accent';
}

export const LedgerActivity: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const entries = useMemo(() => {
    if (!currentSnapshot) return [];
    return currentSnapshot.categories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: ICON_MAP[cat.icon] ?? '📂',
        type: cat.type,
        total: calcCategoryTotal(cat, baseCurrency, currentSnapshot.exchangeRates),
        itemCount: cat.items.length,
        accent: getCategoryAccent(cat.name, cat.type),
      }))
      .filter(e => e.total > 0 || e.itemCount > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [currentSnapshot, baseCurrency]);

  const month = currentSnapshot?.month
    ? new Date(currentSnapshot.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="wp-card section-card">
      <div className="chart-head">
        <div>
          <div className="section-label">Ledger Activity</div>
          {month && <div className="section-sub">{month} snapshot · {entries.length} categories</div>}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="chart-empty">No data in this snapshot yet</div>
      ) : (
        <>
          {entries.map((entry, i) => (
            <div key={entry.id} className={`ledger-row${i < entries.length - 1 ? ' ledger-divider' : ''}`}>
              <div className={`ledger-icon ${entry.accent}`}>{entry.icon}</div>
              <div className="ledger-info">
                <div className="ledger-entity">{entry.name}</div>
                <div className="ledger-sub">{entry.itemCount} item{entry.itemCount !== 1 ? 's' : ''}</div>
              </div>
              <span className={`ledger-cat-tag ${entry.accent}`}>
                {entry.type.toUpperCase()}
              </span>
              <div className={`ledger-amt${entry.type === 'asset' ? ' pos' : ' neg'}`}>
                <CurrencyDisplay amount={entry.total} currency={baseCurrency} abbreviated />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
