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
import { useToast } from '../components/common/Toast';
import { Rocket, Edit2, Plus, Target } from 'lucide-react';
import { StaleBackupBanner } from '../components/common/StaleBackupBanner';
import { DriveRestoreButton } from '../components/common/DriveRestoreButton';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const { currentSnapshot, createNewSnapshot, cloneLatestSnapshot, saveSnapshot, snapshots, goals, preferences } = useApp();
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  const handleCreateSnapshot = async () => {
    const snap = snapshots.length > 0 ? cloneLatestSnapshot() : createNewSnapshot();
    const existing = snapshots.find(s => s.month === snap.month);
    if (existing) {
      navigate(`/editor/${existing.id}`);
      return;
    }
    try {
      await saveSnapshot(snap);
      navigate(`/editor/${snap.id}`);
    } catch {
      toastError('Could not create snapshot. A snapshot for that month may already exist.');
    }
  };


  return (
    <div className="dashboard">
      <StaleBackupBanner />
      {!currentSnapshot ? (
        <div className="glass-card empty-state" style={{ marginTop: '2rem' }}>
          <Rocket size={52} className="empty-state__icon" style={{ color: 'var(--accent-green)', opacity: 0.7 }} />
          <h2 className="text-h1">Welcome to WealthPulse</h2>
          <p className="text-muted" style={{ fontSize: '1rem', maxWidth: '380px' }}>
            Start tracking your net worth by creating your first monthly snapshot.
          </p>
          <button className="btn btn-primary" onClick={handleCreateSnapshot} style={{ fontSize: '1rem', padding: '0.7rem 2rem' }}>
            + Create First Snapshot
          </button>
          <DriveRestoreButton />
        </div>
      ) : (
        <>
          <NetWorthHero />
          <MetricCards />

          {goals.length > 0 && (
            <div className="dashboard-section">
              <div className="dashboard-section__header">
                <Target size={14} />
                <span>Goals</span>
                {goals.length > 2 && (
                  <span className="dashboard-section__count">{goals.length} total</span>
                )}
              </div>
              <div className="dashboard-charts-row">
                {goals.slice(0, 2).map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    currentSnapshot={currentSnapshot}
                    baseCurrency={baseCurrency}
                  />
                ))}
                {goals.length === 1 && <div />}
              </div>
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

          <div className="dashboard-actions">
            <button className="btn btn-outline" onClick={() => navigate(`/editor/${currentSnapshot.id}`)}>
              <Edit2 size={15} style={{ marginRight: '0.4rem' }} /> Edit Snapshot
            </button>
            <button className="btn btn-primary" onClick={handleCreateSnapshot}>
              <Plus size={15} style={{ marginRight: '0.4rem' }} /> New Month
            </button>
          </div>
        </>
      )}
    </div>
  );
};
