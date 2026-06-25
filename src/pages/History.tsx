import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppBase } from '../hooks/useAppBase';
import { SnapshotCompare } from '../components/history/SnapshotCompare';
import { calcNetWorth } from '../utils/calculations';
import { resolveNumberLocale } from '../utils/currencies';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Calendar, Trash2, Edit2, ChevronDown, GitCompare, Search, Printer } from 'lucide-react';
import { printSnapshotReport } from '../utils/printReport';
import './History.css';

/** "YYYY-MM" → same month one year earlier ("YYYY-MM"). */
function yoyMonth(month: string): string {
  const [year, mm] = month.split('-');
  return `${Number(year) - 1}-${mm}`;
}

export const History: React.FC = () => {
  const { snapshots, deleteSnapshot, preferences, goals, confirm, baseCurrency } = useAppBase();
  const navigate = useNavigate();
  const numberLocale = resolveNumberLocale(baseCurrency, preferences?.numberFormat);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [showCompare, setShowCompare] = useState(false);

  const chronological = useMemo(
    () => [...snapshots].sort((a, b) => a.month.localeCompare(b.month)),
    [snapshots]
  );
  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => b.month.localeCompare(a.month)),
    [snapshots]
  );

  const filtered = useMemo(() => sortedSnapshots.filter(s => {
    if (filterFrom && s.month < filterFrom) return false;
    if (filterTo   && s.month > filterTo)   return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const monthLabel = new Date(s.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase();
      if (!monthLabel.includes(q) && !(s.notes ?? '').toLowerCase().includes(q) && !s.month.includes(q)) return false;
    }
    return true;
  }), [sortedSnapshots, filterFrom, filterTo, searchText]);

  // Pre-compute all breakdowns once — avoids repeated calcNetWorth inside the render loop
  const breakdownMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calcNetWorth>>();
    for (const s of snapshots) m.set(s.id, calcNetWorth(s, baseCurrency, 'overall'));
    return m;
  }, [snapshots, baseCurrency]);

  // Chart data (chronological)
  const chartData = useMemo(() => chronological.map(s => ({
    month: s.month,
    label: new Date(s.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    nw: breakdownMap.get(s.id)?.netWorth ?? 0,
  })), [chronological, breakdownMap]);

  // FIRE goal target line
  const fireTarget = useMemo(() => {
    const fireGoal = goals.find(g => g.type === 'fire' && g.targetAmount > 0);
    return fireGoal?.targetAmount ?? null;
  }, [goals]);

  // MoM change map
  const changeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 1; i < chronological.length; i++) {
      const curr = (breakdownMap.get(chronological[i].id)?.netWorth) ?? 0;
      const prev = (breakdownMap.get(chronological[i - 1].id)?.netWorth) ?? 0;
      map.set(chronological[i].id, curr - prev);
    }
    return map;
  }, [chronological, breakdownMap]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm('Are you sure you want to delete this snapshot? This action cannot be undone.', 'destructive');
    if (ok) {
      setDeletingId(id);
      await deleteSnapshot(id);
      setDeletingId(null);
    }
  };

  const canCompare = compareA && compareB && compareA !== compareB;
  const isFiltered = !!(filterFrom || filterTo || searchText);

  if (snapshots.length === 0) {
    return (
      <div className="wp-page">
        <div className="wp-card empty-state">
          <Calendar size={48} className="empty-state__icon" style={{ opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>No history yet</h2>
          <p style={{ color: 'var(--text-3)', maxWidth: 320 }}>Create your first snapshot to start tracking your journey over time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wp-page">
      {/* Timeline Chart */}
      <div className="wp-card hist-timeline">
        <div className="chart-head" style={{ marginBottom: 16 }}>
          <div>
            <div className="section-label">Net Worth Timeline</div>
            <div className="section-sub">{snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} · {chronological[0]?.month} to {chronological[chronological.length - 1]?.month}</div>
          </div>
          <div className="hist-compare-group">
            <select
              className="hist-select"
              value={compareA}
              onChange={e => setCompareA(e.target.value)}
              aria-label="Compare snapshot A"
            >
              <option value="">Compare A…</option>
              {sortedSnapshots.map(s => <option key={s.id} value={s.id}>{s.month}</option>)}
            </select>
            <select
              className="hist-select"
              value={compareB}
              onChange={e => setCompareB(e.target.value)}
              aria-label="Compare snapshot B"
            >
              <option value="">Compare B…</option>
              {sortedSnapshots.map(s => <option key={s.id} value={s.id}>{s.month}</option>)}
            </select>
            <button className="btn btn-outline" disabled={!canCompare} onClick={() => setShowCompare(true)}>
              <GitCompare size={14} /> Compare
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="hist-nw-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="10%" stopColor="#0ea58a" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0ea58a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(val: number) => [new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(val), 'Net Worth']}
            />
            {fireTarget !== null && (
              <ReferenceLine
                y={fireTarget}
                stroke="var(--amber)"
                strokeDasharray="5 3"
                label={{ value: 'FIRE', position: 'right', fill: 'var(--amber)', fontSize: 10 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="nw"
              stroke="#0ea58a"
              strokeWidth={2}
              fill="url(#hist-nw-grad)"
              dot={false}
              activeDot={{ r: 4, fill: '#0ea58a', stroke: 'var(--bg-card-solid)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Filter Bar */}
      <div className="hist-filter-bar">
        <div className="hist-search-wrap">
          <Search size={13} />
          <input
            type="search"
            className="hist-search"
            placeholder="Search month or notes…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            aria-label="Search snapshots"
          />
        </div>
        <div className="hist-filter-group">
          <label className="hist-filter-label">From</label>
          <input type="month" className="hist-filter-input" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div className="hist-filter-group">
          <label className="hist-filter-label">To</label>
          <input type="month" className="hist-filter-input" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        </div>
        {isFiltered && (
          <>
            <span className="hist-count-badge">
              {filtered.length} / {snapshots.length}
            </span>
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
              onClick={() => { setFilterFrom(''); setFilterTo(''); setSearchText(''); }}
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* Snapshot List */}
      <div className="hist-list">
        {filtered.map(snap => {
          const breakdown = breakdownMap.get(snap.id) ?? { netWorth: 0, totalAssets: 0, totalLiabilities: 0, categoryTotals: {} };
          const change = changeMap.get(snap.id) ?? null;
          const isPos = (change ?? 0) >= 0;
          const isExpanded = expandedId === snap.id;
          const monthLabel = new Date(snap.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const yoyCounterpart = snapshots.find(s => s.month === yoyMonth(snap.month));

          return (
            <div key={snap.id} className={`hist-card${isExpanded ? ' hist-card--open' : ''}`}>
              <div
                className="hist-card-row"
                onClick={() => setExpandedId(isExpanded ? null : snap.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedId(isExpanded ? null : snap.id); }}
                aria-expanded={isExpanded}
              >
                <div className="hist-card-month">
                  <span className="hist-month-label">{monthLabel}</span>
                  {snap.notes && (
                    <span className="hist-note-preview">{snap.notes.slice(0, 60)}{snap.notes.length > 60 ? '…' : ''}</span>
                  )}
                </div>

                <div className="hist-card-nw">
                  <CurrencyDisplay amount={breakdown.netWorth} currency={baseCurrency} className="hist-nw-val" />
                  {change !== null && (
                    <span className={`hist-change-pill${isPos ? ' pos' : ' neg'}`}>
                      {isPos ? '+' : '−'}<CurrencyDisplay amount={Math.abs(change)} currency={baseCurrency} abbreviated />
                    </span>
                  )}
                </div>

                <div className="hist-card-actions">
                  <button
                    className="btn-icon"
                    aria-label={`Print report for ${monthLabel}`}
                    title="Print / Save PDF"
                    onClick={e => { e.stopPropagation(); printSnapshotReport(snap, baseCurrency, preferences?.numberFormat); }}
                  >
                    <Printer size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    aria-label={`Edit ${monthLabel}`}
                    onClick={e => { e.stopPropagation(); navigate(`/editor/${snap.id}`); }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn-icon danger"
                    aria-label={`Delete ${monthLabel}`}
                    disabled={deletingId === snap.id}
                    onClick={e => handleDelete(e, snap.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown
                    size={14}
                    className="hist-chevron"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="hist-breakdown">
                  <div className="hist-breakdown-grid">
                    {snap.categories
                      .filter(c => c.items.length > 0)
                      .map(cat => {
                        const val = breakdown.categoryTotals[cat.id] ?? 0;
                        const maxVal = Math.max(0, ...snap.categories.map(c => breakdown.categoryTotals[c.id] ?? 0));
                        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                        return (
                          <div key={cat.id} className="hist-cat-row">
                            <span className="hist-cat-name">{cat.name}</span>
                            <div className="hist-cat-bar-wrap">
                              <div
                                className={`hist-cat-bar${cat.type === 'liability' ? ' neg' : ''}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`hist-cat-val${cat.type === 'liability' ? ' neg' : ''}`}>
                              <CurrencyDisplay amount={val} currency={baseCurrency} abbreviated />
                            </span>
                          </div>
                        );
                      })}
                  </div>
                  <div className="hist-breakdown-foot">
                    <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                      Assets <CurrencyDisplay amount={breakdown.totalAssets} currency={baseCurrency} abbreviated /> · Liabilities <CurrencyDisplay amount={breakdown.totalLiabilities} currency={baseCurrency} abbreviated />
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {yoyCounterpart ? (
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                          title={`Compare with ${yoyCounterpart.month}`}
                          onClick={() => { setCompareA(snap.id); setCompareB(yoyCounterpart.id); setShowCompare(true); }}
                        >
                          <GitCompare size={12} /> vs last year
                        </button>
                      ) : chronological.length < 13 && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                          Year-over-year comparison unlocks once you have 12 months of history
                        </span>
                      )}
                      <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '4px 10px' }} onClick={() => printSnapshotReport(snap, baseCurrency, preferences?.numberFormat)}>
                        <Printer size={12} /> Print
                      </button>
                      <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '4px 10px' }} onClick={() => navigate(`/editor/${snap.id}`)}>
                        <Edit2 size={12} /> Edit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="wp-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
            No snapshots match your filter.
          </div>
        )}
      </div>

      {showCompare && compareA && compareB && (
        <SnapshotCompare
          snapA={snapshots.find(s => s.id === compareA)!}
          snapB={snapshots.find(s => s.id === compareB)!}
          baseCurrency={baseCurrency}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
};
