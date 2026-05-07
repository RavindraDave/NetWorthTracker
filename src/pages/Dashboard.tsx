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
import { StaleBackupBanner } from '../components/common/StaleBackupBanner';
import { DriveRestoreButton } from '../components/common/DriveRestoreButton';
import { Rocket, Target } from 'lucide-react';
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
    <div className="wp-page">
      <StaleBackupBanner />
      {!currentSnapshot ? (
        <div className="wp-card empty-state">
          <Rocket size={52} className="empty-state__icon" style={{ color: 'var(--accent)', opacity: 0.7 }} />
          <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            Welcome to WealthPulse
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-3)', maxWidth: '380px' }}>
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

          <div className="chart-row">
            <TrendChart />
            <DonutChart />
          </div>

          <PerformanceChart />
          <LedgerActivity />

          {goals.length > 0 && (
            <div className="goals-section">
              <div className="chart-head" style={{ marginBottom: 14, padding: 0 }}>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Target size={14} />
                    Active Goals
                  </div>
                  <div className="section-sub">Progress toward financial milestones</div>
                </div>
              </div>
              <div className="goals-grid">
                {goals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    currentSnapshot={currentSnapshot}
                    baseCurrency={baseCurrency}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
