import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calcNetWorth, calcMonthChange, calcSavingsRate } from '../../utils/calculations';
import { calcFIREMetrics } from '../../utils/fireCalculator';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { ScopeToggle } from './ScopeToggle';
import { InfoTooltip } from '../common/InfoTooltip';
import { HELP } from '../common/dashboardHelp';
import { resolveNumberLocale, getCurrencySymbol } from '../../utils/currencies';
import './NetWorthHero.css';

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
      const eased = 1 - Math.pow(1 - progress, 3);
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
  const { currentSnapshot, previousSnapshot, preferences, viewMode, goals } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const breakdown = currentSnapshot
    ? calcNetWorth(currentSnapshot, baseCurrency, viewMode)
    : { netWorth: 0, totalAssets: 0, totalLiabilities: 0, categoryTotals: {} };

  const { change, changePercent } = calcMonthChange(
    currentSnapshot!, previousSnapshot ?? undefined, baseCurrency
  );

  const animatedNW = useCountUp(breakdown.netWorth);
  const numberLocale = resolveNumberLocale(baseCurrency, preferences?.numberFormat);
  const isPositive = change >= 0;

  const month = currentSnapshot?.month
    ? new Date(currentSnapshot.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'No Data';

  const savingsRate = useMemo(() => {
    const income = currentSnapshot?.monthlyIncome ?? 0;
    if (income <= 0) return null;
    return calcSavingsRate(income, currentSnapshot?.monthlyExpenses ?? 0);
  }, [currentSnapshot?.monthlyIncome, currentSnapshot?.monthlyExpenses]);

  const fireMetrics = useMemo(() => {
    const fireGoal = goals.find(g => g.type === 'fire');
    if (!fireGoal || !currentSnapshot) return null;
    return calcFIREMetrics(fireGoal, currentSnapshot, baseCurrency);
  }, [goals, currentSnapshot, baseCurrency]);

  return (
    <div className="hero-card">
      <div className="hero-grad" aria-hidden="true" />
      <div className="hero-left">
        <div className="hero-eyebrow">
          Total Net Worth · {month}
          <InfoTooltip body={HELP.netWorth} />
        </div>
        <div className="hero-num">
          <span className="hero-curr">{getCurrencySymbol(baseCurrency)}</span>
          <span>{animatedNW.toLocaleString(numberLocale)}</span>
        </div>
        <div className="hero-meta">
          <span className={`hero-pill${isPositive ? '' : ' neg'}`}>
            {isPositive ? '▲' : '▼'} <CurrencyDisplay amount={Math.abs(change)} currency={baseCurrency} /> · {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
          <span className="hero-meta-text">vs last month</span>
          {savingsRate !== null && (
            <>
              <span className="hero-meta-sep" />
              <span className="hero-meta-text">
                Savings rate <strong>{savingsRate.toFixed(1)}%</strong>
              </span>
            </>
          )}
          {fireMetrics && fireMetrics.fiNumber > 0 && (
            <>
              <span className="hero-meta-sep" />
              <span className="hero-meta-text">
                Time to FI <strong>
                  {fireMetrics.isFI
                    ? 'Achieved!'
                    : fireMetrics.yearsToFI !== null
                      ? `~${fireMetrics.yearsToFI.toFixed(1)} yrs`
                      : 'Set savings'}
                </strong>
              </span>
            </>
          )}
        </div>
      </div>
      <div className="hero-right">
        <ScopeToggle />
      </div>
    </div>
  );
};
