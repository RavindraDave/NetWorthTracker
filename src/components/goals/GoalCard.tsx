import React from 'react';
import { Goal, Snapshot } from '../../types';
import { calcNetWorthForGoal } from '../../utils/calculations';
import { calcFIREMetrics } from '../../utils/fireCalculator';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { formatCurrency } from '../../utils/currencies';
import { Edit2, Trash2 } from 'lucide-react';
import './GoalCard.css';

interface GoalCardProps {
  goal: Goal;
  currentSnapshot: Snapshot | null;
  baseCurrency: string;
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
}

const TYPE_CLASS: Record<string, string> = {
  fire: 'goal-type-fire',
  net_worth_target: 'goal-type-savings',
  savings: 'goal-type-savings',
  debt_freedom: 'goal-type-debt',
  custom: 'goal-type-savings',
};

const TYPE_LABEL: Record<string, string> = {
  fire: 'FIRE',
  net_worth_target: 'Net Worth',
  savings: 'Savings',
  debt_freedom: 'Debt',
  custom: 'Custom',
};

export const GoalCard: React.FC<GoalCardProps> = ({ goal, currentSnapshot, baseCurrency, onEdit, onDelete }) => {
  // FIRE goals: use calcFIREMetrics (investable NW + item exclusions) — same as FIREDashboard
  // Other goals: use overall NW minus per-goal category exclusions
  const isFIRE = goal.type === 'fire';
  const fireMetrics = isFIRE ? calcFIREMetrics(goal, currentSnapshot, baseCurrency) : null;

  const currentNW = isFIRE
    ? (fireMetrics!.currentNetWorth)
    : (currentSnapshot ? calcNetWorthForGoal(currentSnapshot, baseCurrency, goal.excludedCategoryIds) : 0);

  const target = isFIRE ? fireMetrics!.fiNumber : goal.targetAmount;
  const progressPct = isFIRE
    ? fireMetrics!.progressPercentage
    : Math.min(Math.max(target > 0 ? (currentNW / target) * 100 : 0, 0), 100);

  const hasExclusions = (goal.excludedCategoryIds?.length ?? 0) > 0;

  return (
    <div className="goal-card">
      <div className="goal-card-head">
        <div style={{ minWidth: 0 }}>
          <div className="goal-name">{goal.name}</div>
          <div className="goal-eta">
            {goal.targetDate
              ? new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
              : 'No target date'}
            {hasExclusions && ` · ${goal.excludedCategoryIds!.length} excl.`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span className={`goal-type ${TYPE_CLASS[goal.type] ?? 'goal-type-savings'}`}>
            {TYPE_LABEL[goal.type] ?? goal.type}
          </span>
          {(onEdit || onDelete) && (
            <div style={{ display: 'flex', gap: 4 }}>
              {onEdit && (
                <button className="btn-icon" aria-label="Edit goal" onClick={() => onEdit(goal)} style={{ width: 26, height: 26 }}>
                  <Edit2 size={12} />
                </button>
              )}
              {onDelete && (
                <button className="btn-icon danger" aria-label="Delete goal" onClick={() => onDelete(goal.id)} style={{ width: 26, height: 26 }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="goal-progress">
        <div className="goal-progress-fill" style={{ width: `${progressPct}%` }} />
        {goal.milestones?.map(m => (
          <div
            key={m.id}
            className="goal-progress-milestone"
            style={{ left: `${Math.min(98, Math.max(2, target > 0 ? (m.targetAmount / target) * 100 : 0))}%` }}
            title={`${m.label} — ${formatCurrency(m.targetAmount, baseCurrency)}`}
          />
        ))}
      </div>

      <div className="goal-card-foot">
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          <span style={{ fontFamily: 'var(--font-numeric)', color: 'var(--text-1)', fontWeight: 600 }}>
            <CurrencyDisplay amount={currentNW} currency={baseCurrency} abbreviated />
          </span>
          {' / '}
          <span style={{ fontFamily: 'var(--font-numeric)' }}>
            <CurrencyDisplay amount={target} currency={baseCurrency} abbreviated />
          </span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', fontFamily: 'var(--font-numeric)' }}>
          {progressPct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};
