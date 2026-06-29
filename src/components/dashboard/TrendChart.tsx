import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { buildTrendData, buildCategoryTrendData } from '../../utils/calculations';
import { formatCompactNumber } from '../../utils/numberFormat';
import { ChartTooltip } from './ChartTooltip';
import './TrendChart.css';

const NW_COLOR    = '#0ea58a';
const ASSET_COLOR = '#60a5fa';
const CAT_COLOR   = '#8b5cf6';

export const TrendChart: React.FC = () => {
  const { snapshots, preferences, viewMode, currentSnapshot } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const categories = currentSnapshot?.categories ?? [];

  const overallData = useMemo(
    () => buildTrendData(snapshots, baseCurrency, viewMode),
    [snapshots, baseCurrency, viewMode]
  );

  const selectedCat = categories.find(c => c.id === selectedCatId) ?? null;

  const catData = useMemo(() => {
    if (!selectedCat) return [];
    return buildCategoryTrendData(snapshots, baseCurrency, selectedCat.id, selectedCat.name);
  }, [snapshots, baseCurrency, selectedCat]);

  const data = selectedCatId ? catData : overallData;

  const overallCagr = useMemo(() => {
    if (overallData.length < 2) return null;
    const first = overallData[0].netWorth;
    const last  = overallData[overallData.length - 1].netWorth;
    if (first <= 0 || last / first < 0) return null;
    const result = (Math.pow(last / first, 12 / (overallData.length - 1)) - 1) * 100;
    return Number.isFinite(result) ? result : null;
  }, [overallData]);

  const catCagr = useMemo(() => {
    if (catData.length < 2) return null;
    const first = catData[0].value;
    const last  = catData[catData.length - 1].value;
    if (first <= 0 || last / first < 0) return null;
    const result = (Math.pow(last / first, 12 / (catData.length - 1)) - 1) * 100;
    return Number.isFinite(result) ? result : null;
  }, [catData]);

  const cagr = selectedCatId ? catCagr : overallCagr;

  const catHasNoData = selectedCatId !== null && catData.length > 0 && catData.every(p => p.value === 0);

  if (data.length === 0 && !selectedCatId) {
    return (
      <div className="wp-card chart-trend">
        <div className="section-label">12-Month Trend</div>
        <div className="chart-empty">Add at least 2 monthly snapshots to see the trend</div>
      </div>
    );
  }

  if (catHasNoData) {
    return (
      <div className="wp-card chart-trend">
        <div className="chart-head">
          <div>
            <div className="section-label">12-Month Trend</div>
          </div>
          <select
            className="trend-cat-select"
            value={selectedCatId ?? ''}
            onChange={e => setSelectedCatId(e.target.value || null)}
            aria-label="Filter by category"
          >
            <option value="">All</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="chart-empty">No data for this category in the last 12 months</div>
      </div>
    );
  }

  const monthsLabel = `last ${data.length} month${data.length === 1 ? '' : 's'}`;
  const subLabel = selectedCat
    ? `${selectedCat.name} · ${monthsLabel}`
    : `Net worth (solid) · assets (dashed) · ${monthsLabel}`;

  return (
    <div className="wp-card chart-trend">
      <div className="chart-head">
        <div>
          <div className="section-label">12-Month Trend</div>
          <div className="section-sub">{subLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {categories.length > 0 && (
            <select
              className="trend-cat-select"
              value={selectedCatId ?? ''}
              onChange={e => setSelectedCatId(e.target.value || null)}
              aria-label="Filter by category"
            >
              <option value="">All</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {cagr !== null && (
            <span className="cagr-badge">CAGR · {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%</span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        {selectedCatId ? (
          <AreaChart data={catData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendCat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={CAT_COLOR} stopOpacity={0.22} />
                <stop offset="95%" stopColor={CAT_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCompactNumber} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="value" name={selectedCat?.name ?? 'Category'} stroke={CAT_COLOR} strokeWidth={2} fill="url(#trendCat)" dot={false} />
          </AreaChart>
        ) : (
          <AreaChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            <Area type="monotone" dataKey="assets"   name="Assets"    stroke={ASSET_COLOR} strokeWidth={1.5} strokeDasharray="4 3" fill="url(#trendAssets)" dot={false} />
            <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke={NW_COLOR}    strokeWidth={2}   fill="url(#trendNW)"    dot={false} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};
