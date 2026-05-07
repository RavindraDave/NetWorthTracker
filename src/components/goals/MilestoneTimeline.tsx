import React from 'react';
import { Goal, Snapshot } from '../../types';
import { calcNetWorthForGoal } from '../../utils/calculations';
import { calcFIREMetrics } from '../../utils/fireCalculator';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { CheckCircle2, Circle } from 'lucide-react';
import './MilestoneTimeline.css';

interface MilestoneTimelineProps {
  goals: Goal[];
  currentSnapshot: Snapshot | null;
  baseCurrency: string;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({ goals, currentSnapshot, baseCurrency }) => {
  // Sort goals by target amount
  const sortedGoals = [...goals].sort((a, b) => {
    const targetA = a.type === 'fire' ? (a.annualExpenses || 0) * (a.multiplier || 25) : a.targetAmount;
    const targetB = b.type === 'fire' ? (b.annualExpenses || 0) * (b.multiplier || 25) : b.targetAmount;
    return targetA - targetB;
  });

  if (sortedGoals.length === 0) return null;

  return (
    <div className="milestone-timeline wp-card">
      <h3 className="section-label" style={{ marginBottom: '1.25rem' }}>Milestone Journey</h3>
      <div className="timeline-container">
        {sortedGoals.map((goal, idx) => {
          const target = goal.type === 'fire' ? (goal.annualExpenses || 0) * (goal.multiplier || 25) : goal.targetAmount;
          // FIRE goals: use the same metric as FIREDashboard (investable NW + exclusions)
          // Other goals: use overall NW minus any per-goal exclusions
          const isAchieved = goal.type === 'fire'
            ? calcFIREMetrics(goal, currentSnapshot, baseCurrency).isFI
            : (currentSnapshot
                ? calcNetWorthForGoal(currentSnapshot, baseCurrency, goal.excludedCategoryIds ?? []) >= target && target > 0
                : false);
          
          return (
            <div key={goal.id} className={`timeline-item ${isAchieved ? 'achieved' : ''}`}>
              <div className="timeline-marker">
                {isAchieved
                  ? <CheckCircle2 size={20} style={{ color: 'var(--accent-text)' }} />
                  : <Circle size={20} style={{ color: 'var(--text-3)' }} />}
                {idx < sortedGoals.length - 1 && <div className="timeline-line" />}
              </div>
              <div className="timeline-content">
                <h4 className="timeline-title">{goal.name}</h4>
                <p className="timeline-amount"><CurrencyDisplay amount={target} currency={baseCurrency} abbreviated /></p>
                {isAchieved && <span className="timeline-date">Achieved!</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
