import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, TooltipProps, Legend
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { buildAllocationData } from '../../utils/calculations';
import './DonutChart.css';

const COLORS = ['#4ade80', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#94a3b8'];

function fmt(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_00_00_000) return `${(v / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000)    return `${(v / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)       return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{d.name}</p>
      <p className="chart-tooltip__value" style={{ color: payload[0].fill }}>{fmt(d.value)} ({d.percentage.toFixed(1)}%)</p>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderLegend = (props: any) => {
  const { payload } = props;
  if (!payload) return null;

  return (
    <ul className="donut-legend">
      {payload.map((entry: any, i: number) => (
        <li key={i} className="donut-legend__item">
          <span className="donut-legend__dot" style={{ background: entry.color }} />
          <span className="donut-legend__label">{entry.value}</span>
          <span className="donut-legend__pct">{entry.payload.percentage.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
};

export const DonutChart: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const data = useMemo(() => {
    if (!currentSnapshot) return [];
    return buildAllocationData(currentSnapshot, baseCurrency)
      .filter(d => d.type === 'asset' && d.value > 0)
      .slice(0, 9);
  }, [currentSnapshot, baseCurrency]);

  if (data.length === 0) {
    return (
      <div className="donut-chart glass-card">
        <h3 className="chart-title">Asset Composition</h3>
        <div className="chart-empty">No asset data yet</div>
      </div>
    );
  }

  return (
    <div className="donut-chart glass-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Asset Composition</h3>
          <p className="chart-subtitle">By category</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
            stroke="none"
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
