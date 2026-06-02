import React, { useState, useEffect } from 'react';
import { Goal, Snapshot } from '../../types';
import { calcFIREMetrics } from '../../utils/fireCalculator';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { InfoTooltip } from '../common/InfoTooltip';
import { HELP } from '../common/dashboardHelp';
import { Target, TrendingUp, Clock, Zap, Sparkles, X } from 'lucide-react';
import './FIREDashboard.css';

interface FIREDashboardProps {
  goal: Goal;
  currentSnapshot: Snapshot | null;
  baseCurrency: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

type ScenarioState = {
  annualExpenses: number;
  expectedReturn: number;
  inflationRate: number;
  annualSavingsGrowth: number;
};

export const FIREDashboard: React.FC<FIREDashboardProps> = ({ goal, currentSnapshot, baseCurrency, onEdit, onDelete }) => {
  const metrics = calcFIREMetrics(goal, currentSnapshot, baseCurrency);
  const progressPct = Math.min(Math.max(metrics.progressPercentage, 0), 100);

  const categories = currentSnapshot?.categories ?? [];
  const nonInvestableNames = categories
    .filter(c => c.type === 'asset' && !c.isInvestable)
    .map(c => c.name);
  const goalExcludedNames = (goal.excludedCategoryIds ?? [])
    .map(id => categories.find(c => c.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  const excludedNames = Array.from(new Set([...nonInvestableNames, ...goalExcludedNames]));
  const scopeTooltip = `${HELP.investableView}${
    excludedNames.length ? ` Excluded here: ${excludedNames.join(', ')}.` : ''
  }`;

  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenario, setScenario] = useState<ScenarioState>({
    annualExpenses:    goal.annualExpenses    ?? 0,
    expectedReturn:    goal.expectedReturn    ?? 7,
    inflationRate:     goal.inflationRate     ?? 3,
    annualSavingsGrowth: goal.annualSavingsGrowth ?? 0,
  });

  // Reset scenario when goal changes
  useEffect(() => {
    setScenario({
      annualExpenses:    goal.annualExpenses    ?? 0,
      expectedReturn:    goal.expectedReturn    ?? 7,
      inflationRate:     goal.inflationRate     ?? 3,
      annualSavingsGrowth: goal.annualSavingsGrowth ?? 0,
    });
    setScenarioOpen(false);
  }, [goal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scenarioMetrics = scenarioOpen
    ? calcFIREMetrics({ ...goal, ...scenario }, currentSnapshot, baseCurrency)
    : null;

  const setField = (field: keyof ScenarioState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    // Keep previous value when input is cleared/partial — prevents silent snap to 0
    if (Number.isFinite(v)) setScenario(prev => ({ ...prev, [field]: v }));
  };

  const deltaYears = scenarioMetrics && metrics.yearsToFI !== null && scenarioMetrics.yearsToFI !== null
    ? metrics.yearsToFI - scenarioMetrics.yearsToFI
    : null;

  return (
    <div className={`wp-card fire-dashboard${metrics.isFI ? ' fire-dashboard--achieved' : ''}`}>

      {/* Header */}
      <div className="fire-dash-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <Target size={16} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
            <span className="fire-dash-name">{goal.name}</span>
            {metrics.isFI && (
              <span className="fire-achieved-badge">Financially Independent 🎉</span>
            )}
          </div>
          <span className="fire-dash-meta">
            Target&nbsp;
            <CurrencyDisplay amount={metrics.fiNumber} currency={baseCurrency} abbreviated />
            &nbsp;·&nbsp;{goal.multiplier ?? 25}× annual expenses&nbsp;·&nbsp;{metrics.realReturnRate.toFixed(1)}% real return
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignSelf: 'flex-start' }}>
          {onEdit && (
            <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={onEdit}>
              Edit
            </button>
          )}
          {onDelete && (
            <button className="btn btn-outline danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.72rem', color: 'var(--text-3)' }}>
          <span>Investable assets only</span>
          <InfoTooltip body={scopeTooltip} />
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

      {/* What if? toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          className="btn btn-outline"
          style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setScenarioOpen(o => !o)}
          aria-expanded={scenarioOpen}
        >
          <Sparkles size={12} />
          {scenarioOpen ? 'Close scenario' : 'What if?'}
        </button>
      </div>

      {/* Scenario panel */}
      {scenarioOpen && (
        <div className="fire-scenario-panel">
          <div className="fire-scenario-head">
            <span className="fire-scenario-title">Scenario — override goal assumptions</span>
            <button className="btn-icon" onClick={() => setScenarioOpen(false)} aria-label="Close scenario">
              <X size={14} />
            </button>
          </div>

          <div className="fire-scenario-grid">
            <div className="fire-scenario-field">
              <label className="fire-scenario-label">Annual Expenses</label>
              <input
                type="number"
                className="fire-scenario-input"
                value={scenario.annualExpenses || ''}
                onChange={setField('annualExpenses')}
                min={0}
                step={10000}
                placeholder={String(goal.annualExpenses ?? 0)}
              />
            </div>
            <div className="fire-scenario-field">
              <label className="fire-scenario-label">Return % p.a.</label>
              <input
                type="number"
                className="fire-scenario-input"
                value={scenario.expectedReturn}
                onChange={setField('expectedReturn')}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
            <div className="fire-scenario-field">
              <label className="fire-scenario-label">Inflation % p.a.</label>
              <input
                type="number"
                className="fire-scenario-input"
                value={scenario.inflationRate}
                onChange={setField('inflationRate')}
                min={0}
                max={50}
                step={0.5}
              />
            </div>
            <div className="fire-scenario-field">
              <label className="fire-scenario-label">Savings growth %</label>
              <input
                type="number"
                className="fire-scenario-input"
                value={scenario.annualSavingsGrowth}
                onChange={setField('annualSavingsGrowth')}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </div>

          {scenarioMetrics && (
            <div className="fire-scenario-compare">
              <span>
                Scenario: &nbsp;
                {scenarioMetrics.isFI ? (
                  <span className="fire-scenario-result">Already FI</span>
                ) : scenarioMetrics.yearsToFI !== null ? (
                  <span className="fire-scenario-result">{scenarioMetrics.yearsToFI.toFixed(1)} yrs to FI</span>
                ) : (
                  <span style={{ color: 'var(--rose)', fontWeight: 600, fontFamily: 'var(--font-numeric)' }}>No path</span>
                )}
              </span>
              {deltaYears !== null && Math.abs(deltaYears) >= 0.05 && (
                <span className={`fire-scenario-delta${deltaYears > 0 ? ' better' : ' worse'}`}>
                  {deltaYears > 0 ? `▲ saves ${deltaYears.toFixed(1)} yrs` : `▼ adds ${Math.abs(deltaYears).toFixed(1)} yrs`}
                  {' '}vs saved goal
                </span>
              )}
              {deltaYears === null && metrics.yearsToFI === null && scenarioMetrics.yearsToFI !== null && (
                <span className="fire-scenario-delta better">▲ scenario creates a path to FI</span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-3)' }}>
                FI&nbsp;#&nbsp;<CurrencyDisplay amount={scenarioMetrics.fiNumber} currency={baseCurrency} abbreviated />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
