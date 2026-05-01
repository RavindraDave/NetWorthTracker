import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcNetWorth } from '../utils/calculations';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import { Calendar, Trash2, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import './History.css';

export const History: React.FC = () => {
  const { snapshots, deleteSnapshot, preferences } = useApp();
  const navigate = useNavigate();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  // Newest-first for display
  const sortedSnapshots = [...snapshots].sort((a, b) => b.month.localeCompare(a.month));
  // Chronological order for accurate MoM delta lookups
  const chronological = [...snapshots].sort((a, b) => a.month.localeCompare(b.month));

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this snapshot? This action cannot be undone.')) {
      await deleteSnapshot(id);
    }
  };

  if (snapshots.length === 0) {
    return (
      <div className="history-empty glass-card text-center" style={{ padding: '4rem' }}>
        <Calendar size={48} className="text-muted" style={{ margin: '0 auto 1rem auto' }} />
        <h2 className="text-h2">No History Yet</h2>
        <p className="text-muted">Create your first snapshot to start tracking your journey over time.</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h1 className="text-h1">Snapshot History</h1>
        <p className="text-muted">Review and manage your past net worth records.</p>
      </div>

      <div className="history-grid">
        {sortedSnapshots.map((snap) => {
          const breakdown = calcNetWorth(snap, baseCurrency, 'overall');
          // Find this snapshot's position in chronological order, then grab the one before it
          const chronoIdx = chronological.findIndex(s => s.id === snap.id);
          const prevSnap = chronoIdx > 0 ? chronological[chronoIdx - 1] : undefined;
          let change = 0;

          if (prevSnap) {
            const prevBreakdown = calcNetWorth(prevSnap, baseCurrency, 'overall');
            change = breakdown.netWorth - prevBreakdown.netWorth;
          }

          const isPositive = change >= 0;

          return (
            <div 
              key={snap.id} 
              className="history-card glass-card"
              onClick={() => navigate(`/editor/${snap.id}`)}
            >
              <div className="history-card__header">
                <div className="history-card__month">
                  <Calendar size={18} className="text-muted" />
                  <span className="text-h3">
                    {new Date(snap.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="history-card__actions">
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); navigate(`/editor/${snap.id}`); }}>
                    <Edit2 size={16} />
                  </button>
                  <button className="btn-icon danger" onClick={(e) => handleDelete(e, snap.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="history-card__body">
                <div className="history-card__nw">
                  <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Net Worth</span>
                  <CurrencyDisplay amount={breakdown.netWorth} currency={baseCurrency} className="text-h2" />
                </div>
                
                {prevSnap && (
                  <div className={`history-card__change ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <CurrencyDisplay amount={Math.abs(change)} currency={baseCurrency} abbreviated />
                  </div>
                )}
              </div>

              <div className="history-card__footer">
                <div className="history-card__stat">
                  <span className="text-muted">Assets:</span>
                  <span className="text-positive"><CurrencyDisplay amount={breakdown.totalAssets} currency={baseCurrency} abbreviated /></span>
                </div>
                <div className="history-card__stat">
                  <span className="text-muted">Liabilities:</span>
                  <span className="text-negative"><CurrencyDisplay amount={breakdown.totalLiabilities} currency={baseCurrency} abbreviated /></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
