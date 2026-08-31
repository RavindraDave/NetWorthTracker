/**
 * Per-item FIRE projection — a second, composition-aware growth line
 * alongside the existing single-blended-rate projection in `fireCalculator.ts`.
 *
 * Rate source per item: `itemReturnPct` (stated yield, else CAGR from cost
 * basis). An item with neither is held FLAT at 0% real growth — deliberately
 * NOT backfilled with the goal's blended `expectedReturn`. Silently implying
 * a plain savings account compounds at portfolio speed is exactly the kind of
 * quietly-wrong number a net-worth tool must never produce (rejected during
 * implementation review). `hasUnratedItems` on the result lets the UI show an
 * honest footnote instead.
 *
 * Future monthly savings are modelled the same way: contributed at nominal
 * value, never grown — new money hasn't been placed into any rated
 * instrument yet, so growing it would repeat the same quietly-wrong pattern.
 */
import { Goal, LineItem, Snapshot, Category } from '../types';
import { convertToBase, calcNetWorthForGoal, filterByViewMode } from './calculations';
import { itemReturnPct, monthEndDate } from './returns';
import { calculateOutstandingBalance, isLoanConfigComplete } from './loanCalculator';

export interface ProjectionPoint {
  month: string;   // "YYYY-MM"
  label: string;   // "Jan '26"
  blended: number;
  perItem: number;
}

export interface FireProjection {
  points: ProjectionPoint[];
  /** True when at least one in-scope asset item has no stated rate or cost basis. */
  hasUnratedItems: boolean;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * One item's projected value at `target`, given its own return signal.
 * A loan-backed liability amortises via `calculateOutstandingBalance`
 * regardless of `itemReturnPct` (loan schedules aren't a "rate"). A liability
 * without complete loan config is always held flat — no shrink assumption.
 */
export function projectItemValue(
  item: LineItem,
  categoryType: 'asset' | 'liability',
  asOf: Date,
  target: Date,
): number {
  if (categoryType === 'liability') {
    const isLoan = isLoanConfigComplete(item.loanPrincipal, item.annualInterestRate, item.tenureMonths, item.loanStartMonth);
    if (!isLoan) return item.amount;
    return calculateOutstandingBalance(
      item.loanPrincipal!, item.annualInterestRate!, item.tenureMonths!, item.loanStartMonth!, monthKey(target),
    );
  }

  const ratePct = itemReturnPct(item, asOf);
  if (ratePct === undefined) return item.amount; // held flat — no assumed rate

  const months = monthsBetween(asOf, target);
  if (months <= 0) return item.amount;
  const monthlyRate = Math.pow(1 + ratePct / 100, 1 / 12) - 1;
  return item.amount * Math.pow(1 + monthlyRate, months);
}

/**
 * Two projection series from `snapshot.month` to `goal.targetDate` (falling
 * back to +20 years, capped at 600 months like `fireCalculator.ts`'s own
 * simulation cap): the existing single-blended-rate line (same math as
 * `calcMonthsToFI`'s simulation branch, reused as a value series rather than
 * a months-to-target scalar) and the new per-item line.
 *
 * Scope mirrors `calcNetWorthForGoal` exactly: 'investable' view mode, minus
 * `goal.excludedCategoryIds`, minus items excluded from net worth or goals —
 * so `points[0].perItem` equals `calcNetWorthForGoal`'s current value.
 */
export function buildFireProjection(snapshot: Snapshot, goal: Goal, baseCurrency: string): FireProjection {
  const asOf = monthEndDate(snapshot.month);
  const targetRaw = goal.targetDate ? new Date(goal.targetDate) : addMonths(asOf, 240);
  const target = targetRaw > asOf ? targetRaw : addMonths(asOf, 240);
  const totalMonths = Math.max(1, Math.min(monthsBetween(asOf, target), 600));

  const nominalReturn = (goal.expectedReturn ?? 7) / 100;
  const inflation = (goal.inflationRate ?? 3) / 100;
  const realAnnualReturn = (1 + nominalReturn) / (1 + inflation) - 1;
  const monthlyRate = realAnnualReturn / 12;
  const annualSavingsGrowth = (goal.annualSavingsGrowth ?? 0) / 100;
  const monthlyGrowthFactor = Math.pow(1 + annualSavingsGrowth, 1 / 12);

  const excluded = new Set(goal.excludedCategoryIds ?? []);
  const scopedCategories: Category[] = filterByViewMode(snapshot.categories, 'investable')
    .filter(c => !excluded.has(c.id));

  const inScopeItems: { item: LineItem; type: 'asset' | 'liability'; currency: string }[] = [];
  let hasUnratedItems = false;
  for (const cat of scopedCategories) {
    for (const item of cat.items) {
      if (item.excludeFromNetWorth || item.excludeFromGoals) continue;
      inScopeItems.push({ item, type: cat.type, currency: item.currency });
      if (cat.type === 'asset' && itemReturnPct(item, asOf) === undefined) hasUnratedItems = true;
    }
  }

  const perItemAt = (checkpoint: Date, cumulativeContributed: number): number => {
    let total = cumulativeContributed;
    for (const { item, type } of inScopeItems) {
      const projected = projectItemValue(item, type, asOf, checkpoint);
      const base = convertToBase(projected, item.currency, baseCurrency, snapshot.exchangeRates);
      total += type === 'asset' ? base : -base;
    }
    return total;
  };

  const points: ProjectionPoint[] = [];
  const label = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  let blended = calcNetWorthForGoal(snapshot, baseCurrency, goal.excludedCategoryIds ?? [], 'investable');
  let monthlySavings = Math.max(0, (snapshot.monthlyIncome ?? 0) - (snapshot.monthlyExpenses ?? 0));
  let contributed = 0;

  points.push({ month: monthKey(asOf), label: label(asOf), blended: Math.round(blended), perItem: Math.round(perItemAt(asOf, 0)) });

  for (let m = 1; m <= totalMonths; m++) {
    blended = blended * (1 + monthlyRate) + monthlySavings;
    contributed += monthlySavings;
    monthlySavings *= monthlyGrowthFactor;

    const checkpoint = addMonths(asOf, m);
    points.push({
      month: monthKey(checkpoint),
      label: label(checkpoint),
      blended: Math.round(blended),
      perItem: Math.round(perItemAt(checkpoint, contributed)),
    });
  }

  return { points, hasUnratedItems };
}
