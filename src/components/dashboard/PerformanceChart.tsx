import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calcCategoryTotal } from '../../utils/calculations';
import { formatCompactNumber } from '../../utils/numberFormat';
import './PerformanceChart.css';

export const PerformanceChart: React.FC = () => {
  const { currentSnapshot, previousSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const data = useMemo(() => {
    if (!currentSnapshot || !previousSnapshot) return [];
    return currentSnapshot.categories
      .filter(c => c.type === 'asset')
      .map(cat => {
        const curr = calcCategoryTotal(cat, baseCurrency, currentSnapshot.exchangeRates);
        const prevCat = previousSnapshot.categories.find(
          c => c.id === cat.id || (c.name === cat.name && c.type === cat.type)
        );
        const prev = prevCat ? calcCategoryTotal(prevCat, baseCurrency, previousSnapshot.exchangeRates) : 0;
        return {
          name: cat.name.length > 22 ? cat.name.slice(0, 20) + '…' : cat.name,
          value: curr - prev,
        };
      })
      .filter(d => d.value !== 0)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 7);
  }, [currentSnapshot, previousSnapshot, baseCurrency]);

  const prevMonth = previousSnapshot?.month
    ? new Date(previousSnapshot.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : null;

  const maxAbs = data.length > 0 ? Math.max(...data.map(d => Math.abs(d.value))) : 1;

  if (!previousSnapshot) {
    return (
      <div className="wp-card section-card">
        <div className="chart-head">
          <div className="section-label">Monthly Performance</div>
        </div>
        <div className="chart-empty">Add another snapshot to see month-over-month changes</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="wp-card section-card">
        <div className="chart-head">
          <div className="section-label">Monthly Performance</div>
        </div>
        <div className="chart-empty">No changes between snapshots</div>
      </div>
    );
  }

  return (
    <div className="wp-card section-card">
      <div className="chart-head">
        <div>
          <div className="section-label">Monthly Performance</div>
          <div className="section-sub">Per-category change vs {prevMonth}</div>
        </div>
        {currentSnapshot?.month && (
          <span className="muted-chip">
            {new Date(currentSnapshot.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
      <div className="perf-bars">
        {data.map((item, i) => {
          const isPos = item.value >= 0;
          const pct = (Math.abs(item.value) / maxAbs) * 50;
          return (
            <div
              key={i}
              className="perf-bar-row"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="perf-name" title={item.name}>{item.name}</div>
              <div className="perf-track">
                <div className="perf-mid" />
                <div
                  className={`perf-fill${isPos ? ' perf-fill-pos' : ' perf-fill-neg'}`}
                  style={isPos
                    ? { left: '50%', width: `${pct}%` }
                    : { right: '50%', width: `${pct}%` }
                  }
                />
              </div>
              <div className={`perf-val${isPos ? ' pos' : ' neg'}`}>
                {isPos ? '+' : '−'}{formatCompactNumber(Math.abs(item.value))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
