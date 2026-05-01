import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NetWorthHero } from '../components/dashboard/NetWorthHero';
import { MetricCards } from '../components/dashboard/MetricCards';
import { TrendChart } from '../components/dashboard/TrendChart';
import { PerformanceChart } from '../components/dashboard/PerformanceChart';
import { DonutChart } from '../components/dashboard/DonutChart';
import { LedgerActivity } from '../components/dashboard/LedgerActivity';
import { GoalCard } from '../components/goals/GoalCard';
import { useApp } from '../context/AppContext';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const { currentSnapshot, createNewSnapshot, cloneLatestSnapshot, saveSnapshot, snapshots, goals, preferences } = useApp();
  const navigate = useNavigate();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  const handleCreateSnapshot = async () => {
    const snap = snapshots.length > 0 ? cloneLatestSnapshot() : createNewSnapshot();
    await saveSnapshot(snap);
    navigate(`/editor/${snap.id}`);
  };


  return (
    <div className="dashboard">
      {!currentSnapshot ? (
        <div className="dashboard-empty glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '2rem' }}>
          <div className="dashboard-empty__icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚀</div>
          <h2 className="text-h1" style={{ marginBottom: '1rem' }}>Welcome to WealthPulse</h2>
          <p className="text-muted" style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>Start tracking your net worth by creating your first monthly snapshot.</p>
          <button className="btn btn-primary dashboard-empty__cta" onClick={handleCreateSnapshot} style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
            + Create First Snapshot
          </button>
        </div>
      ) : (
        <>
          <NetWorthHero />
          <MetricCards />

          {goals.length > 0 && (
            <div className="dashboard-charts-row dashboard-charts-row--goals">
              {goals.slice(0, 2).map(goal => (
                <GoalCard 
                  key={goal.id} 
                  goal={goal} 
                  currentSnapshot={currentSnapshot} 
                  baseCurrency={baseCurrency} 
                />
              ))}
            </div>
          )}

          <div className="dashboard-charts-row">
            <TrendChart />
            <DonutChart />
          </div>

          <div className="dashboard-charts-row dashboard-charts-row--wide">
            <PerformanceChart />
            <LedgerActivity />
          </div>

          <div className="dashboard-actions" style={{ gap: '1rem' }}>
            <button className="btn btn-outline" onClick={() => navigate(`/editor/${currentSnapshot.id}`)}>
              ✏️ Edit Current Snapshot
            </button>
            <button className="btn btn-outline" onClick={handleCreateSnapshot}>
              📋 Clone → Next Month
            </button>
          </div>
        </>
      )}
    </div>
  );
};
