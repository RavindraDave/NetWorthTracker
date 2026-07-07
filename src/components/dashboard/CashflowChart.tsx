import React, { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { calcSavingsRate } from '../../utils/calculations';
import { formatCompactNumber } from '../../utils/numberFormat';
import { resolveNumberLocale } from '../../utils/currencies';
import './CashflowChart.css';

// Validated 3-hue palette (light + dark surfaces): income emerald, expenses
// rose, savings-rate purple. Income/expenses follow the app's asset/liability
// colour convention; identity is also carried by the legend and tooltips.
const INCOME_COLOR  = 'var(--accent)';
const EXPENSE_COLOR = 'var(--rose)';
const RATE_COLOR    = '#8b5cf6';

interface CashflowPoint {
  label: string;
  income: number;
  expenses: number;
  rate: number; // savings rate %
}

/**
 * E4 — monthly cash-flow summary: income vs expenses bars with a separate
 * savings-rate strip below (two panels sharing the month axis — a % and a
 * currency scale never share one plot). Reads the `monthlyIncome` /
 * `monthlyExpenses` fields already captured per snapshot.
 */
export const CashflowChart: React.FC = () => {
  const { snapshots, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';
  const numberLocale = resolveNumberLocale(baseCurrency, preferences?.numberFormat);

  const data = useMemo<CashflowPoint[]>(() => {
    return [...snapshots]
      .sort((a, b) => a.month.localeCompare(b.month))
      .filter(s => (s.monthlyIncome ?? 0) > 0 || (s.monthlyExpenses ?? 0) > 0)
      .slice(-12)
      .map(s => {
        const [year, month] = s.month.split('-');
        const date = new Date(Number(year), Number(month) - 1);
        return {
          label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          income: s.monthlyIncome ?? 0,
          expenses: s.monthlyExpenses ?? 0,
          rate: parseFloat(calcSavingsRate(s.monthlyIncome ?? 0, s.monthlyExpenses ?? 0).toFixed(1)),
        };
      });
  }, [snapshots]);

  const hasNegativeRate = data.some(d => d.rate < 0);

  if (data.length === 0) {
    return (
      <div className="wp-card section-card">
        <div className="chart-head">
          <div>
            <div className="section-label">Monthly Cash Flow</div>
            <div className="section-sub">Income, expenses and savings rate over time</div>
          </div>
        </div>
        <div className="chart-empty">
          Add monthly income &amp; expenses in the snapshot editor to see savings trends
        </div>
      </div>
    );
  }

  const monthsLabel = `last ${data.length} month${data.length === 1 ? '' : 's'}`;

  return (
    <div className="wp-card section-card cashflow-chart">
      <div className="chart-head">
        <div>
          <div className="section-label">Monthly Cash Flow</div>
          <div className="section-sub">Income vs expenses · savings rate — {monthsLabel}</div>
        </div>
        <div className="cashflow-legend" aria-hidden="true">
          <span className="cashflow-legend-item">
            <span className="cashflow-legend-dot" style={{ background: INCOME_COLOR }} />Income
          </span>
          <span className="cashflow-legend-item">
            <span className="cashflow-legend-dot" style={{ background: EXPENSE_COLOR }} />Expenses
          </span>
          <span className="cashflow-legend-item">
            <span className="cashflow-legend-dot cashflow-legend-dot--line" style={{ background: RATE_COLOR }} />Savings rate
          </span>
        </div>
      </div>

      {/* Panel 1 — currency scale: income vs expenses */}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} syncId="cashflow" margin={{ top: 4, right: 10, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke="rgba(127,127,127,0.08)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis
            tickFormatter={(v: number) => formatCompactNumber(v, numberLocale)}
            tick={{ fill: 'var(--text-3)', fontSize: 11 }}
            axisLine={false} tickLine={false} width={55}
          />
          <Tooltip
            cursor={{ fill: 'rgba(127,127,127,0.06)' }}
            contentStyle={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(val: number, name: string) => [
              new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(val),
              name,
            ]}
          />
          <Bar dataKey="income"   name="Income"   fill={INCOME_COLOR}  radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expenses" name="Expenses" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>

      {/* Panel 2 — % scale: savings rate */}
      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={data} syncId="cashflow" margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: 'var(--text-3)', fontSize: 10 }}
            axisLine={false} tickLine={false} width={55}
            domain={[(dataMin: number) => Math.min(0, Math.floor(dataMin)), (dataMax: number) => Math.ceil(dataMax)]}
          />
          {hasNegativeRate && <ReferenceLine y={0} stroke="var(--text-3)" strokeDasharray="3 3" />}
          <Tooltip
            contentStyle={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(val: number) => [`${val.toFixed(1)}%`, 'Savings rate']}
          />
          <Line
            type="monotone" dataKey="rate" name="Savings rate"
            stroke={RATE_COLOR} strokeWidth={2} dot={false}
            activeDot={{ r: 4, fill: RATE_COLOR, stroke: 'var(--bg-card-solid)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
