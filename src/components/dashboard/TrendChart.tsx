import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { buildTrendData } from '../../utils/calculations';
import { formatCompactNumber } from '../../utils/numberFormat';
import { ChartTooltip } from './ChartTooltip';
import './TrendChart.css';

export const TrendChart: React.FC = () => {
  const { snapshots, preferences, viewMode } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const data = useMemo(() => buildTrendData(snapshots, baseCurrency, viewMode), [snapshots, baseCurrency, viewMode]);

  if (data.length === 0) {
    return (
      <div className="trend-chart glass-card">
        <h3 className="chart-title">Net Worth Trend</h3>
        <div className="chart-empty">Add at least 2 monthly snapshots to see the trend</div>
      </div>
    );
  }

  return (
    <div className="trend-chart glass-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Net Worth Trend</h3>
          <p className="chart-subtitle">Last {data.length} months</p>
        </div>
        <div className="chart-legend">
          <span className="legend-dot" style={{ background: '#4ade80' }} />
          <span>Net Worth</span>
          <span className="legend-dot" style={{ background: '#60a5fa' }} />
          <span>Assets</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorNW" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCompactNumber}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="assets"
            name="Assets"
            stroke="#60a5fa"
            strokeWidth={1.5}
            fill="url(#colorAssets)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            name="Net Worth"
            stroke="#4ade80"
            strokeWidth={2}
            fill="url(#colorNW)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
