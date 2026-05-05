import React from 'react';
import { Goal, Snapshot } from '../../types';
import { calcNetWorth } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { ProgressRing } from './ProgressRing';
import { Edit2, Trash2 } from 'lucide-react';
import './GoalCard.css';

interface GoalCardProps {
  goal: Goal;
  currentSnapshot: Snapshot | null;
  baseCurrency: string;
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, currentSnapshot, baseCurrency, onEdit, onDelete }) => {
  const currentNW = currentSnapshot ? calcNetWorth(currentSnapshot, baseCurrency, 'overall').netWorth : 0;

  const rawProgress = goal.targetAmount > 0 ? (currentNW / goal.targetAmount) * 100 : 0;
  const progressPercentage = Math.min(Math.max(rawProgress, 0), 100);

  return (
    <div className="goal-card glass-card">
      <div className="goal-card__header">
        <h3 className="goal-card__title">{goal.name}</h3>
        <div className="goal-card__header-right">
          <span className="goal-card__type badge-default">{goal.type.replace(/_/g, ' ')}</span>
          {(onEdit || onDelete) && (
            <div className="goal-card__actions">
              {onEdit && (
                <button className="btn-icon" aria-label="Edit goal" onClick={() => onEdit(goal)}>
                  <Edit2 size={14} />
                </button>
              )}
              {onDelete && (
                <button className="btn-icon danger" aria-label="Delete goal" onClick={() => onDelete(goal.id)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="goal-card__body">
        <div className="goal-card__progress-col">
          <ProgressRing radius={45} stroke={6} progress={progressPercentage} color="#a855f7">
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>{progressPercentage.toFixed(0)}%</span>
          </ProgressRing>
        </div>
        <div className="goal-card__info-col">
          <p className="goal-card__label">Current</p>
          <p className="goal-card__value"><CurrencyDisplay amount={currentNW} currency={baseCurrency}  /></p>

          <div className="goal-card__divider" />

          <p className="goal-card__label">Target</p>
          <p className="goal-card__value"><CurrencyDisplay amount={goal.targetAmount} currency={baseCurrency}  /></p>
        </div>
      </div>

      {goal.milestones && goal.milestones.length > 0 && (
        <div className="goal-card__milestones">
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            {goal.milestones.length} milestone{goal.milestones.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {goal.targetDate && (
        <div className="goal-card__footer">
          Target Date: {new Date(goal.targetDate).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};
