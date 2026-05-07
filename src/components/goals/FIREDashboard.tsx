import React from 'react';
import { Goal, Snapshot } from '../../types';
import { calcFIREMetrics } from '../../utils/fireCalculator';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { Target, TrendingUp, Clock, Zap } from 'lucide-react';
import './FIREDashboard.css';

interface FIREDashboardProps {
  goal: Goal;
  currentSnapshot: Snapshot | null;
  baseCurrency: string;
}

export const FIREDashboard: React.FC<FIREDashboardProps> = ({ goal, currentSnapshot, baseCurrency }) => {
  const metrics = calcFIREMetrics(goal, currentSnapshot, baseCurrency);
  const progressPct = Math.min(Math.max(metrics.progressPercentage, 0), 100);

  return (
    <div className={`wp-card fire-dashboard${metrics.isFI ? ' fire-dashboard--achieved' : ''}`}>

      {/* Header */}
      <div className="fire-dash-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Target size={16} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
            <span className="fire-dash-name">{goal.name}</span>
          </div>
          <span className="fire-dash-meta">
            Target&nbsp;
            <CurrencyDisplay amount={metrics.fiNumber} currency={baseCurrency} abbreviated />
            &nbsp;·&nbsp;{goal.multiplier}× annual expenses&nbsp;·&nbsp;{metrics.realReturnRate.toFixed(1)}% real return
          </span>
        </div>
        {metrics.isFI && (
          <span className="fire-achieved-badge">Financially Independent 🎉</span>
        )}
      </div>

      {/* Progress */}
      <div className="fire-dash-progress-section">
        <div className="fire-dash-progress-bar">
          <div
            className="fire-dash-progress-fill"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="fire-dash-progress-labels">
          <span style={{ fontFamily: 'var(--font-numeric)', fontSize: '0.78rem', color: 'var(--text-2)' }}>
            <CurrencyDisplay amount={metrics.currentNetWorth} currency={baseCurrency} abbreviated />
            <span style={{ color: 'var(--text-3)' }}>
              &nbsp;/&nbsp;<CurrencyDisplay amount={metrics.fiNumber} currency={baseCurrency} abbreviated />
            </span>
          </span>
          <span style={{ fontFamily: 'var(--font-numeric)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-text)' }}>
            {progressPct.toFixed(1)}% Funded
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="fire-dash-stats">
        <div className="fire-stat">
          <div className="fire-stat-icon"><Clock size={14} /></div>
          <div>
            <div className="fire-stat-label">Time to FI</div>
            <div className="fire-stat-value">
              {metrics.isFI
                ? <span style={{ color: 'var(--accent-text)' }}>Achieved!</span>
                : metrics.yearsToFI !== null
                  ? `${metrics.yearsToFI.toFixed(1)} yrs`
                  : metrics.monthlySavings < 0
                    ? <span style={{ color: 'var(--rose)' }}>Negative savings</span>
                    : <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Add cash flow</span>
              }
            </div>
          </div>
        </div>

        <div className="fire-stat">
          <div className="fire-stat-icon"><TrendingUp size={14} /></div>
          <div>
            <div className="fire-stat-label">Savings Rate</div>
            <div className="fire-stat-value">{metrics.savingsRatePercentage.toFixed(1)}%</div>
            <div className="fire-stat-sub">
              <CurrencyDisplay amount={metrics.monthlySavings} currency={baseCurrency} abbreviated /> / mo
            </div>
          </div>
        </div>

        <div className="fire-stat">
          <div className="fire-stat-icon"><Zap size={14} /></div>
          <div>
            <div className="fire-stat-label">SWR {metrics.safeWithdrawalRate.toFixed(1)}%</div>
            <div className="fire-stat-value">
              <CurrencyDisplay amount={metrics.monthlyPassiveIncome} currency={baseCurrency} abbreviated />
            </div>
            <div className="fire-stat-sub">Passive income / mo</div>
          </div>
        </div>
      </div>
    </div>
  );
};
