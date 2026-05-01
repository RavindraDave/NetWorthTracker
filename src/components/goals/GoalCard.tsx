import React from 'react';
import { Goal, Snapshot } from '../../types';
import { calcNetWorth } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { ProgressRing } from './ProgressRing';
import './GoalCard.css';

interface GoalCardProps {
  goal: Goal;
  currentSnapshot: Snapshot | null;
  baseCurrency: string;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, currentSnapshot, baseCurrency }) => {
  const currentNW = currentSnapshot ? calcNetWorth(currentSnapshot, baseCurrency, 'overall').netWorth : 0;
  
  // Custom logic based on goal type could go here. 
  // For 'net_worth_target', progress is current NW / target
  const rawProgress = goal.targetAmount > 0 ? (currentNW / goal.targetAmount) * 100 : 0;
  const progressPercentage = Math.min(Math.max(rawProgress, 0), 100);

  return (
    <div className="goal-card glass-card">
      <div className="goal-card__header">
        <h3 className="goal-card__title">{goal.name}</h3>
        <span className="goal-card__type badge-default">{goal.type.replace(/_/g, ' ')}</span>
      </div>

      <div className="goal-card__body">
        <div className="goal-card__progress-col">
          <ProgressRing radius={45} stroke={6} progress={progressPercentage} color="#a855f7">
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>{progressPercentage.toFixed(0)}%</span>
          </ProgressRing>
        </div>
        <div className="goal-card__info-col">
          <p className="goal-card__label">Current</p>
          <p className="goal-card__value"><CurrencyDisplay amount={currentNW} currency={baseCurrency} abbreviated /></p>
          
          <div className="goal-card__divider" />
          
          <p className="goal-card__label">Target</p>
          <p className="goal-card__value"><CurrencyDisplay amount={goal.targetAmount} currency={baseCurrency} abbreviated /></p>
        </div>
      </div>
      
      {goal.targetDate && (
        <div className="goal-card__footer">
          Target Date: {new Date(goal.targetDate).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};
