import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Goal, Snapshot } from '../../types';
import { buildFireProjection } from '../../utils/itemProjection';
import { formatCompactNumber } from '../../utils/numberFormat';
import { resolveNumberLocale } from '../../utils/currencies';
import { ChartTooltip } from '../dashboard/ChartTooltip';
import { AlertTriangle } from 'lucide-react';
import './FIREProjectionChart.css';

interface FIREProjectionChartProps {
  goal: Goal;
  snapshot: Snapshot | null;
  baseCurrency: string;
  numberFormat?: 'auto' | 'lakh' | 'international';
}

const BLENDED_COLOR = '#0ea58a';
const PER_ITEM_COLOR = '#8b5cf6';

/**
 * "Blended" reuses the same single-rate compounding model as the goal's
 * headline metrics (`fireCalculator.ts`). "Per-item" grows each holding at
 * its OWN rate (stated yield or CAGR) instead — a composition-aware second
 * opinion. They're a real divergent pair, not a confidence band, because an
 * unrated holding is honestly held flat rather than borrowing the blended
 * rate (see `itemProjection.ts`).
 */
export const FIREProjectionChart: React.FC<FIREProjectionChartProps> = ({ goal, snapshot, baseCurrency, numberFormat }) => {
  const numberLocale = resolveNumberLocale(baseCurrency, numberFormat);

  const projection = useMemo(() => {
    if (!snapshot) return null;
    return buildFireProjection(snapshot, goal, baseCurrency);
  }, [snapshot, goal, baseCurrency]);

  if (!projection || projection.points.length < 2) return null;

  const { points, hasUnratedItems } = projection;
  // Thin the x-axis to ~6 ticks regardless of horizon length (up to 600 months).
  const tickInterval = Math.max(0, Math.floor(points.length / 6));

  return (
    <div className="fire-projection">
      <div className="fire-projection__head">
        <span className="fire-projection__title">Projected Net Worth</span>
        <span className="fire-projection__legend">
          <span className="fire-projection__dot" style={{ background: BLENDED_COLOR }} /> Blended
          <span className="fire-projection__dot" style={{ background: PER_ITEM_COLOR }} /> Per-item
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis dataKey="label" interval={tickInterval} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v: number) => formatCompactNumber(v, numberLocale)} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="blended" name="Blended" stroke={BLENDED_COLOR} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="perItem" name="Per-item" stroke={PER_ITEM_COLOR} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      {hasUnratedItems && (
        <p className="fire-projection__note">
          <AlertTriangle size={12} />
          Some holdings have no stated return or purchase cost — the per-item line holds them flat
          rather than guessing. Add a return rate on those items for a fuller picture.
        </p>
      )}
    </div>
  );
};
