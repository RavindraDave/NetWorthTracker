import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { SnapshotCompare } from '../components/history/SnapshotCompare';
import { calcNetWorth } from '../utils/calculations';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import { Calendar, Trash2, Edit2, TrendingUp, TrendingDown, GitCompare } from 'lucide-react';
import './History.css';

export const History: React.FC = () => {
  const { snapshots, deleteSnapshot, preferences } = useApp();
  const { confirm } = useToast();
  const navigate = useNavigate();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [showCompare, setShowCompare] = useState(false);

  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => b.month.localeCompare(a.month)),
    [snapshots]
  );
  const chronological = useMemo(
    () => [...snapshots].sort((a, b) => a.month.localeCompare(b.month)),
    [snapshots]
  );

  const filtered = useMemo(() => sortedSnapshots.filter(s => {
    if (filterFrom && s.month < filterFrom) return false;
    if (filterTo   && s.month > filterTo)   return false;
    return true;
  }), [sortedSnapshots, filterFrom, filterTo]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm('Are you sure you want to delete this snapshot? This action cannot be undone.', 'destructive');
    if (ok) {
      setDeletingId(id);
      await deleteSnapshot(id);
      setDeletingId(null);
    }
  };

  const snapForCompare = (id: string) => snapshots.find(s => s.id === id);
  const canCompare = compareA && compareB && compareA !== compareB;

  if (snapshots.length === 0) {
    return (
      <div className="glass-card empty-state">
        <Calendar size={48} className="empty-state__icon" />
        <h2 className="text-h2">No history yet</h2>
        <p className="text-muted">Create your first snapshot to start tracking your journey over time.</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1 className="text-h1">Snapshot History</h1>
          <p className="text-muted">Review and manage your past net worth records.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="history-filters glass-card">
        <div className="history-filter-group">
          <label className="history-filter-label">From</label>
          <input type="month" className="history-filter-input" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div className="history-filter-group">
          <label className="history-filter-label">To</label>
          <input type="month" className="history-filter-input" value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
        </div>
        {(filterFrom || filterTo) && (
          <>
            <div className="history-filter-badge">
              Showing {filtered.length} of {snapshots.length}
              {filterFrom && ` · from ${filterFrom}`}
              {filterTo && ` to ${filterTo}`}
            </div>
            <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={() => { setFilterFrom(''); setFilterTo(''); }}>
              Clear
            </button>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Compare */}
        <div className="history-compare-group">
          <select className="history-filter-input" value={compareA} onChange={e => setCompareA(e.target.value)}>
            <option value="">Compare A…</option>
            {sortedSnapshots.map(s => <option key={s.id} value={s.id}>{s.month}</option>)}
          </select>
          <select className="history-filter-input" value={compareB} onChange={e => setCompareB(e.target.value)}>
            <option value="">Compare B…</option>
            {sortedSnapshots.map(s => <option key={s.id} value={s.id}>{s.month}</option>)}
          </select>
          <button className="btn btn-outline" disabled={!canCompare} onClick={() => setShowCompare(true)}>
            <GitCompare size={14} /> Compare
          </button>
        </div>
      </div>

      <div className="history-grid">
        {filtered.map((snap) => {
          const breakdown = calcNetWorth(snap, baseCurrency, 'overall');
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
                  <button className="btn-icon" aria-label="Edit snapshot" onClick={(e) => { e.stopPropagation(); navigate(`/editor/${snap.id}`); }}>
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="btn-icon danger"
                    aria-label="Delete snapshot"
                    disabled={deletingId === snap.id}
                    onClick={(e) => handleDelete(e, snap.id)}
                  >
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

      {filtered.length === 0 && (
        <p className="text-muted text-center" style={{ padding: '2rem' }}>
          No snapshots in the selected date range.
        </p>
      )}

      {showCompare && compareA && compareB && snapForCompare(compareA) && snapForCompare(compareB) && (
        <SnapshotCompare
          snapA={snapForCompare(compareA)!}
          snapB={snapForCompare(compareB)!}
          baseCurrency={baseCurrency}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
};
