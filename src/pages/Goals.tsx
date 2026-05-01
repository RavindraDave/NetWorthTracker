import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GoalEditor } from '../components/goals/GoalEditor';
import { FIREDashboard } from '../components/goals/FIREDashboard';
import { GoalCard } from '../components/goals/GoalCard';
import { MilestoneTimeline } from '../components/goals/MilestoneTimeline';
import { Plus } from 'lucide-react';
import './Goals.css';

export const Goals: React.FC = () => {
  const { goals, currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Separate FIRE goals from normal goals
  const fireGoals = goals.filter(g => g.type === 'fire');
  const otherGoals = goals.filter(g => g.type !== 'fire');

  return (
    <div className="goals-page">
      <div className="goals-header">
        <div>
          <h1 className="text-h1">Goals & FIRE Tracker</h1>
          <p className="text-muted">Track your journey to Financial Independence and other milestones.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsEditorOpen(true)}>
          <Plus size={16} style={{ marginRight: '0.5rem' }} /> Add Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
          <h2 className="text-h2">No goals set yet</h2>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>
            Set a target net worth or calculate your FIRE number to start tracking your progress.
          </p>
          <button className="btn btn-primary" onClick={() => setIsEditorOpen(true)}>
            Create First Goal
          </button>
        </div>
      ) : (
        <>
          {/* Main FIRE Dashboard (assuming the first FIRE goal is the primary one) */}
          {fireGoals.length > 0 && (
            <FIREDashboard 
              goal={fireGoals[0]} 
              currentSnapshot={currentSnapshot} 
              baseCurrency={baseCurrency} 
            />
          )}

          <div className="goals-grid-container">
            <div className="goals-main-col">
              <h2 className="text-h2" style={{ marginBottom: '1.5rem' }}>Other Targets</h2>
              {otherGoals.length === 0 ? (
                <p className="text-muted">No additional targets set.</p>
              ) : (
                <div className="other-goals-grid">
                  {otherGoals.map(goal => (
                    <GoalCard 
                      key={goal.id} 
                      goal={goal} 
                      currentSnapshot={currentSnapshot} 
                      baseCurrency={baseCurrency} 
                    />
                  ))}
                </div>
              )}
            </div>
            
            <div className="goals-sidebar-col">
              <MilestoneTimeline 
                goals={goals} 
                currentSnapshot={currentSnapshot} 
                baseCurrency={baseCurrency} 
              />
            </div>
          </div>
        </>
      )}

      {isEditorOpen && <GoalEditor onClose={() => setIsEditorOpen(false)} />}
    </div>
  );
};
