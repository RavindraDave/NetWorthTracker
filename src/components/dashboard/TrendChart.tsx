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

const NW_COLOR   = '#0ea58a';
const ASSET_COLOR = '#60a5fa';

export const TrendChart: React.FC = () => {
  const { snapshots, preferences, viewMode } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const data = useMemo(() => buildTrendData(snapshots, baseCurrency, viewMode), [snapshots, baseCurrency, viewMode]);

  const cagr = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].netWorth;
    const last = data[data.length - 1].netWorth;
    if (first <= 0) return null;
    const months = data.length - 1;
    return (Math.pow(last / first, 12 / months) - 1) * 100;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="wp-card chart-trend">
        <div className="section-label">12-Month Trend</div>
        <div className="chart-empty">Add at least 2 monthly snapshots to see the trend</div>
      </div>
    );
  }

  return (
    <div className="wp-card chart-trend">
      <div className="chart-head">
        <div>
          <div className="section-label">12-Month Trend</div>
          <div className="section-sub">Net worth (solid) · assets (dashed) · last {data.length} months</div>
        </div>
        {cagr !== null && (
          <span className="cagr-badge">CAGR · {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendNW" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={NW_COLOR}    stopOpacity={0.22} />
              <stop offset="95%" stopColor={NW_COLOR}    stopOpacity={0} />
            </linearGradient>
            <linearGradient id="trendAssets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={ASSET_COLOR} stopOpacity={0.12} />
              <stop offset="95%" stopColor={ASSET_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatCompactNumber} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="assets"   name="Assets"     stroke={ASSET_COLOR} strokeWidth={1.5} strokeDasharray="4 3" fill="url(#trendAssets)" dot={false} />
          <Area type="monotone" dataKey="netWorth" name="Net Worth"  stroke={NW_COLOR}    strokeWidth={2}   fill="url(#trendNW)"    dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
