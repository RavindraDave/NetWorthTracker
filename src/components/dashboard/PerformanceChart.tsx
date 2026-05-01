import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { buildAllocationData } from '../../utils/calculations';
import { formatCompactNumber as fmt } from '../../utils/numberFormat';
import { ChartTooltip } from './ChartTooltip';
import './PerformanceChart.css';

const COLORS = ['#4ade80', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15'];

export const PerformanceChart: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const data = useMemo(() => {
    if (!currentSnapshot) return [];
    return buildAllocationData(currentSnapshot, baseCurrency)
      .filter(d => d.type === 'asset' && d.value > 0)
      .slice(0, 8)
      .map(d => ({
        name: d.name.length > 16 ? d.name.slice(0, 14) + '…' : d.name,
        fullName: d.name,
        value: d.value,
        percentage: d.percentage,
      }));
  }, [currentSnapshot, baseCurrency]);

  if (data.length === 0) {
    return (
      <div className="performance-chart glass-card">
        <h3 className="chart-title">Portfolio Performance</h3>
        <div className="chart-empty">No asset data to display</div>
      </div>
    );
  }

  return (
    <div className="performance-chart glass-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Portfolio Performance</h3>
          <p className="chart-subtitle">Asset breakdown by category</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<ChartTooltip usePayloadName showPercentage />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
