import React from 'react';
import { Goal, Snapshot } from '../../types';
import { calcNetWorth } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { CheckCircle2, Circle } from 'lucide-react';
import './MilestoneTimeline.css';

interface MilestoneTimelineProps {
  goals: Goal[];
  currentSnapshot: Snapshot | null;
  baseCurrency: string;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({ goals, currentSnapshot, baseCurrency }) => {
  const currentNW = currentSnapshot ? calcNetWorth(currentSnapshot, baseCurrency, 'overall').netWorth : 0;

  // Sort goals by target amount
  const sortedGoals = [...goals].sort((a, b) => {
    const targetA = a.type === 'fire' ? (a.annualExpenses || 0) * (a.multiplier || 25) : a.targetAmount;
    const targetB = b.type === 'fire' ? (b.annualExpenses || 0) * (b.multiplier || 25) : b.targetAmount;
    return targetA - targetB;
  });

  if (sortedGoals.length === 0) return null;

  return (
    <div className="milestone-timeline glass-card">
      <h3 className="text-h2" style={{ marginBottom: '1.5rem' }}>Milestone Journey</h3>
      <div className="timeline-container">
        {sortedGoals.map((goal, idx) => {
          const target = goal.type === 'fire' ? (goal.annualExpenses || 0) * (goal.multiplier || 25) : goal.targetAmount;
          const isAchieved = currentNW >= target && target > 0;
          
          return (
            <div key={goal.id} className={`timeline-item ${isAchieved ? 'achieved' : ''}`}>
              <div className="timeline-marker">
                {isAchieved ? <CheckCircle2 className="text-positive" size={20} /> : <Circle className="text-muted" size={20} />}
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
