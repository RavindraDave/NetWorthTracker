import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../context/AppContext';
import { buildAllocationData, buildCurrencyAllocationData } from '../../utils/calculations';
import { buildSubCategoryAllocationData, hasSubCategories } from '../../utils/subCategories';
import { ChartTooltip } from './ChartTooltip';
import { ChevronRight, X } from 'lucide-react';
import './DonutChart.css';

const COLORS = [
  '#0ea58a', '#3b82f6', '#8b5cf6', '#0891b2', '#f59e0b',
  '#f472b6', '#fb923c', '#34d399', '#94a3b8',
];

export const DonutChart: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';
  const [view, setView] = useState<'category' | 'currency'>('category');
  const [drillCatId, setDrillCatId] = useState<string | null>(null);

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

  /** Categories worth drilling into — one 100% slice would be a pointless click. */
  const drillableIds = useMemo(() => {
    if (!currentSnapshot) return new Set<string>();
    return new Set(
      currentSnapshot.categories.filter(hasSubCategories).map(c => c.id),
    );
  }, [currentSnapshot]);

  const drillCategory = currentSnapshot?.categories.find(c => c.id === drillCatId) ?? null;

  const drillData = useMemo(() => {
    if (!currentSnapshot || !drillCatId) return [];
    return buildSubCategoryAllocationData(currentSnapshot, baseCurrency, drillCatId);
  }, [currentSnapshot, baseCurrency, drillCatId]);

  // Only show toggle when the snapshot contains items in ≥2 distinct currencies
  const showToggle = currencyData.length >= 2;

  // Reset to category view if currencies drop below 2 (e.g. after deleting items)
  useEffect(() => {
    if (!showToggle && view === 'currency') setView('category');
  }, [showToggle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leave the drill-down if its category stops being drillable — its groups were
  // deleted, or the snapshot changed underneath us.
  useEffect(() => {
    if (drillCatId && !drillableIds.has(drillCatId)) setDrillCatId(null);
  }, [drillCatId, drillableIds]);

  const isDrilled = !!drillCatId && drillData.length > 0;
  const inCurrencyView = view === 'currency' && showToggle;

  const data = isDrilled ? drillData : inCurrencyView ? currencyData : categoryData;
  const total = data.reduce((s, d) => s + d.value, 0);

  const canDrill = (id: string) => !isDrilled && !inCurrencyView && drillableIds.has(id);

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
        <div className="section-label donut-crumbs">
          Asset Allocation
          {isDrilled && (
            <>
              <ChevronRight size={13} className="donut-crumb-sep" aria-hidden="true" />
              <span className="donut-crumb-current">{drillCategory?.name}</span>
              <button
                type="button"
                className="donut-crumb-close"
                onClick={() => setDrillCatId(null)}
                aria-label="Back to all categories"
                title="Back to all categories"
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
        {showToggle && !isDrilled && (
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
      {/* Says which denominator the percentages use — in a drill-down they are a
          share of that one category, not of all assets. */}
      <div className="section-sub" style={{ marginBottom: 14 }}>
        {isDrilled ? `% of ${drillCategory?.name}` : inCurrencyView ? 'By denomination' : 'By category'}
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
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  cursor={canDrill(d.id) ? 'pointer' : undefined}
                  onClick={canDrill(d.id) ? () => setDrillCatId(d.id) : undefined}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip usePayloadName showPercentage />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="alloc-legend">
        {data.map((d, i) => {
          const drillable = canDrill(d.id);
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;
          const content = (
            <>
              <span className="alloc-leg-dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="alloc-leg-name">{d.name}</span>
              <span className="alloc-leg-pct">{pct}%</span>
            </>
          );

          // Only categories that actually have groups become buttons — offering the
          // affordance on the rest would promise a drill-down that shows one slice.
          return drillable ? (
            <button
              key={i}
              type="button"
              className="alloc-leg-row alloc-leg-row--drillable"
              onClick={() => setDrillCatId(d.id)}
              aria-label={`Break down ${d.name} by sub-group`}
            >
              {content}
              <ChevronRight size={12} className="alloc-leg-chevron" aria-hidden="true" />
            </button>
          ) : (
            <div key={i} className="alloc-leg-row">{content}</div>
          );
        })}
      </div>
    </div>
  );
};
