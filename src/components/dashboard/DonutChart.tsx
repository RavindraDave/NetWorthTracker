import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../context/AppContext';
import { buildAllocationData, buildCurrencyAllocationData } from '../../utils/calculations';
import { ChartTooltip } from './ChartTooltip';
import './DonutChart.css';

const COLORS = [
  '#0ea58a', '#3b82f6', '#8b5cf6', '#0891b2', '#f59e0b',
  '#f472b6', '#fb923c', '#34d399', '#94a3b8',
];

export const DonutChart: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';
  const [view, setView] = useState<'category' | 'currency'>('category');

  const categoryData = useMemo(() => {
    if (!currentSnapshot) return [];
    return buildAllocationData(currentSnapshot, baseCurrency)
      .filter(d => d.type === 'asset' && d.value > 0)
      .slice(0, 9);
  }, [currentSnapshot, baseCurrency]);

  const currencyData = useMemo(() => {
    if (!currentSnapshot) return [];
    return buildCurrencyAllocationData(currentSnapshot, baseCurrency).slice(0, 9);
  }, [currentSnapshot, baseCurrency]);

  // Only show toggle when the snapshot contains items in ≥2 distinct currencies
  const showToggle = currencyData.length >= 2;
  const data = view === 'currency' && showToggle ? currencyData : categoryData;
  const total = data.reduce((s, d) => s + d.value, 0);

  if (categoryData.length === 0) {
    return (
      <div className="wp-card chart-donut">
        <div className="section-label">Asset Allocation</div>
        <div className="section-sub" style={{ marginBottom: 14 }}>By category</div>
        <div className="chart-empty">No asset data yet</div>
      </div>
    );
  }

  return (
    <div className="wp-card chart-donut">
      <div className="donut-head">
        <div className="section-label">Asset Allocation</div>
        {showToggle && (
          <div className="donut-view-toggle" role="group" aria-label="Allocation view">
            <button
              className={`donut-view-btn${view === 'category' ? ' active' : ''}`}
              onClick={() => setView('category')}
              aria-pressed={view === 'category'}
            >
              Category
            </button>
            <button
              className={`donut-view-btn${view === 'currency' ? ' active' : ''}`}
              onClick={() => setView('currency')}
              aria-pressed={view === 'currency'}
            >
              Currency
            </button>
          </div>
        )}
      </div>
      <div className="section-sub" style={{ marginBottom: 14 }}>
        {view === 'currency' && showToggle ? 'By denomination' : 'By category'}
      </div>

      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip usePayloadName showPercentage />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="alloc-legend">
        {data.map((d, i) => (
          <div key={i} className="alloc-leg-row">
            <span className="alloc-leg-dot" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="alloc-leg-name">{d.name}</span>
            <span className="alloc-leg-pct">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
