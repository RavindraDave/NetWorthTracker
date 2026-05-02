import React from 'react';
import { Goal, Snapshot } from '../../types';
import { calcFIREMetrics } from '../../utils/fireCalculator';
import { ProgressRing } from './ProgressRing';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { Badge } from '../common/Badge';
import { Target, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import './FIREDashboard.css';

interface FIREDashboardProps {
  goal: Goal;
  currentSnapshot: Snapshot | null;
  baseCurrency: string;
}

export const FIREDashboard: React.FC<FIREDashboardProps> = ({ goal, currentSnapshot, baseCurrency }) => {
  const metrics = calcFIREMetrics(goal, currentSnapshot, baseCurrency);

  return (
    <div className="fire-dashboard glass-card">
      <div className="fire-dashboard__header">
        <div>
          <h2 className="text-h2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={24} className="text-positive" />
            {goal.name}
          </h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            Target: <CurrencyDisplay amount={metrics.fiNumber} currency={baseCurrency} abbreviated />
            {' '}({goal.multiplier}x Annual Expenses) · {metrics.realReturnRate.toFixed(1)}% real return
          </p>
        </div>
        {metrics.isFI && (
          <Badge variant="positive" className="fire-badge">FINANCIALLY INDEPENDENT 🎉</Badge>
        )}
      </div>

      <div className="fire-dashboard__grid">
        {/* Main Progress Ring */}
        <div className={`fire-dashboard__main-progress${metrics.isFI ? ' fire-dashboard__main-progress--achieved' : ''}`}>
          <ProgressRing
            radius={110}
            stroke={12}
            progress={metrics.progressPercentage}
            color={metrics.isFI ? '#22c55e' : '#3b82f6'}
          >
            <span className="fire-progress__value">{metrics.progressPercentage.toFixed(1)}%</span>
            <span className="fire-progress__label">{metrics.isFI ? '🎉 FI' : 'Funded'}</span>
          </ProgressRing>
          <div className="fire-progress__details">
            <p className="text-muted">Current Portfolio</p>
            <p className="text-h2"><CurrencyDisplay amount={metrics.currentNetWorth} currency={baseCurrency} abbreviated /></p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="fire-dashboard__stats">
          <div className="fire-stat-card">
            <div className="fire-stat-card__icon"><Clock size={18} /></div>
            <div className="fire-stat-card__content">
              <p className="fire-stat-card__label">Estimated Time to FI</p>
              <p className="fire-stat-card__value">
                {metrics.isFI ? 'Achieved!' : (
                  metrics.yearsToFI !== null 
                    ? `${metrics.yearsToFI.toFixed(1)} Years` 
                    : <span style={{ fontSize: '0.9rem', color: 'var(--accent-red)' }}>Negative Savings</span>
                )}
              </p>
            </div>
          </div>

          <div className="fire-stat-card">
            <div className="fire-stat-card__icon" style={{ color: 'var(--accent-green)' }}><TrendingUp size={18} /></div>
            <div className="fire-stat-card__content">
              <p className="fire-stat-card__label">Savings Rate</p>
              <p className="fire-stat-card__value">
                {metrics.savingsRatePercentage.toFixed(1)}%
              </p>
              <p className="fire-stat-card__subtext">
                <CurrencyDisplay amount={metrics.monthlySavings} currency={baseCurrency} abbreviated /> / mo
              </p>
            </div>
          </div>

          <div className="fire-stat-card">
            <div className="fire-stat-card__icon" style={{ color: 'var(--accent-purple)' }}><AlertCircle size={18} /></div>
            <div className="fire-stat-card__content">
              <p className="fire-stat-card__label">Safe Withdrawal ({metrics.safeWithdrawalRate.toFixed(1)}%)</p>
              <p className="fire-stat-card__value">
                <CurrencyDisplay amount={metrics.monthlyPassiveIncome} currency={baseCurrency} abbreviated />
              </p>
              <p className="fire-stat-card__subtext">Passive Income / mo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
