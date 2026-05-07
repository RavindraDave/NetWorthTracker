import React from 'react';
import { useApp } from '../../context/AppContext';
import { calcNetWorth } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import './MetricCards.css';

export const MetricCards: React.FC = () => {
  const { currentSnapshot, previousSnapshot, preferences, viewMode } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const curr = currentSnapshot ? calcNetWorth(currentSnapshot, baseCurrency, viewMode) : null;
  const prev = previousSnapshot ? calcNetWorth(previousSnapshot, baseCurrency, viewMode) : null;

  const assetChange = curr && prev ? ((curr.totalAssets - prev.totalAssets) / Math.max(prev.totalAssets, 1)) * 100 : null;
  const liabChange  = curr && prev ? ((curr.totalLiabilities - prev.totalLiabilities) / Math.max(prev.totalLiabilities, 1)) * 100 : null;
  const nwChange    = curr && prev ? curr.netWorth - prev.netWorth : null;
  const nwChangePct = curr && prev ? ((curr.netWorth - prev.netWorth) / Math.max(Math.abs(prev.netWorth), 1)) * 100 : null;

  return (
    <div className="metrics-3">
      {/* Total Assets */}
      <div className="wp-card metric-tile">
        <div className="metric-tile-head">
          <span className="metric-label">Total Assets</span>
          <span className="metric-icon-pos">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </span>
        </div>
        <div className="metric-num">
          <CurrencyDisplay amount={curr?.totalAssets ?? 0} currency={baseCurrency} />
        </div>
        <div className={`metric-sub${assetChange !== null && assetChange >= 0 ? ' pos' : assetChange !== null ? ' neg' : ''}`}>
          {assetChange !== null ? `${assetChange >= 0 ? '+' : ''}${assetChange.toFixed(1)}% MoM` : '—'}
        </div>
      </div>

      {/* Total Liabilities */}
      <div className="wp-card metric-tile">
        <div className="metric-tile-head">
          <span className="metric-label">Total Liabilities</span>
          <span className="metric-icon-neg">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
              <polyline points="17 18 23 18 23 12"/>
            </svg>
          </span>
        </div>
        <div className="metric-num">
          <CurrencyDisplay amount={curr?.totalLiabilities ?? 0} currency={baseCurrency} />
        </div>
        <div className={`metric-sub${liabChange !== null && liabChange <= 0 ? ' pos' : liabChange !== null && liabChange > 0 ? ' neg' : ''}`}>
          {liabChange !== null ? `${liabChange >= 0 ? '+' : ''}${liabChange.toFixed(1)}% MoM` : '—'}
        </div>
      </div>

      {/* Net Change */}
      <div className="wp-card metric-tile">
        <div className="metric-tile-head">
          <span className="metric-label">Net Change This Month</span>
          <span className={nwChange !== null && nwChange >= 0 ? 'metric-icon-pos' : 'metric-icon-neg'}>
            {nwChange !== null && nwChange >= 0 ? '▲' : '▼'}
          </span>
        </div>
        <div className={`metric-num${nwChange !== null && nwChange >= 0 ? ' pos' : ''}`}>
          {nwChange !== null ? (
            <><span>{nwChange >= 0 ? '+' : '−'}</span><CurrencyDisplay amount={Math.abs(nwChange)} currency={baseCurrency} /></>
          ) : '—'}
        </div>
        <div className={`metric-sub${nwChangePct !== null && nwChangePct >= 0 ? ' pos' : nwChangePct !== null ? ' neg' : ''}`}>
          {nwChangePct !== null ? `${nwChangePct >= 0 ? '+' : ''}${nwChangePct.toFixed(2)}% · vs last month` : '—'}
        </div>
      </div>
    </div>
  );
};
