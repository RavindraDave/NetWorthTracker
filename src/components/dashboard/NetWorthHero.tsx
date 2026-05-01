import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calcNetWorth, calcMonthChange } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import './NetWorthHero.css';

const VIEWS = ['Overall', 'Liquid', 'Investable'] as const;

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    startRef.current = null;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(start + diff * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
      else prevTarget.current = target;
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export const NetWorthHero: React.FC = () => {
  const { currentSnapshot, previousSnapshot, preferences, viewMode, setViewMode } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const breakdown = currentSnapshot
    ? calcNetWorth(currentSnapshot, baseCurrency, viewMode)
    : { netWorth: 0, totalAssets: 0, totalLiabilities: 0, categoryTotals: {} };

  const { change, changePercent } = calcMonthChange(
    currentSnapshot!, previousSnapshot ?? undefined, baseCurrency
  );

  const animatedNW = useCountUp(breakdown.netWorth);
  const isPositive = change >= 0;
  const month = currentSnapshot?.month
    ? new Date(currentSnapshot.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'No Data';

  return (
    <div className="nw-hero glass-card">
      <div className="nw-hero__top">
        <div>
          <p className="nw-hero__label">Total Net Worth · {month}</p>
          <div className="nw-hero__amount">
            <CurrencyDisplay amount={animatedNW} currency={baseCurrency} />
          </div>
          {currentSnapshot && (
            <div className={`nw-hero__change ${isPositive ? 'positive' : 'negative'}`}>
              <span className="nw-hero__change-arrow">{isPositive ? '▲' : '▼'}</span>
              <CurrencyDisplay amount={Math.abs(change)} currency={baseCurrency} abbreviated showSign={false} />
              <span className="nw-hero__change-pct">({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)</span>
              <span className="nw-hero__change-label">vs last month</span>
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="nw-hero__view-toggle">
          {VIEWS.map(v => (
            <button
              key={v}
              className={`view-toggle-btn ${viewMode === v.toLowerCase() ? 'active' : ''}`}
              onClick={() => setViewMode(v.toLowerCase() as any)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {!currentSnapshot && (
        <p className="nw-hero__empty">No snapshot yet. Create your first monthly snapshot to get started.</p>
      )}
    </div>
  );
};
