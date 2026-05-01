import React from 'react';
import { useApp } from '../../context/AppContext';
import { calcNetWorth } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import './MetricCards.css';

interface MetricCardProps {
  title: string;
  amount: number;
  currency: string;
  change?: number;
  changeLabel?: string;
  accent?: 'green' | 'red' | 'blue';
  icon: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, amount, currency, change, changeLabel, accent = 'blue', icon }) => {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className={`metric-card glass-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <span className="metric-card__icon">{icon}</span>
        <span className="metric-card__title">{title}</span>
      </div>
      <div className="metric-card__amount">
        <CurrencyDisplay amount={amount} currency={currency} abbreviated />
      </div>
      {change !== undefined && (
        <div className={`metric-card__change ${isPositive ? 'positive' : 'negative'}`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          <CurrencyDisplay amount={Math.abs(change)} currency={currency} abbreviated />
          <span className="metric-card__change-label">{changeLabel ?? 'vs prev'}</span>
        </div>
      )}
    </div>
  );
};

export const MetricCards: React.FC = () => {
  const { currentSnapshot, previousSnapshot, preferences, viewMode } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const curr = currentSnapshot ? calcNetWorth(currentSnapshot, baseCurrency, viewMode) : null;
  const prev = previousSnapshot ? calcNetWorth(previousSnapshot, baseCurrency, viewMode) : null;

  const assetChange = curr && prev ? curr.totalAssets - prev.totalAssets : undefined;
  const liabChange  = curr && prev ? curr.totalLiabilities - prev.totalLiabilities : undefined;
  const nwChange    = curr && prev ? curr.netWorth - prev.netWorth : undefined;

  return (
    <div className="metric-cards-grid">
      <MetricCard
        title="Total Assets"
        amount={curr?.totalAssets ?? 0}
        currency={baseCurrency}
        change={assetChange}
        changeLabel="vs last month"
        accent="green"
        icon="📈"
      />
      <MetricCard
        title="Total Liabilities"
        amount={curr?.totalLiabilities ?? 0}
        currency={baseCurrency}
        change={liabChange}
        changeLabel="vs last month"
        accent="red"
        icon="📉"
      />
      <MetricCard
        title="Net Change"
        amount={nwChange ?? 0}
        currency={baseCurrency}
        accent="blue"
        icon="⚡"
      />
    </div>
  );
};
