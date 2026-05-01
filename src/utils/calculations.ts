import { Snapshot, Category } from '../types';

/**
 * Convert a single line item's amount to the base currency.
 */
export function convertToBase(
  amount: number,
  currency: string,
  baseCurrency: string,
  exchangeRates: Record<string, number>
): number {
  if (currency === baseCurrency) return amount;
  const rate = exchangeRates[currency];
  if (!rate) return amount; // fallback: treat as 1:1
  return amount * rate;
}

/**
 * Calculate total for a category in base currency.
 */
export function calcCategoryTotal(
  category: Category,
  baseCurrency: string,
  exchangeRates: Record<string, number>
): number {
  return category.items
    .filter(item => !item.excludeFromNetWorth)
    .reduce((sum, item) => sum + convertToBase(item.amount, item.currency, baseCurrency, exchangeRates), 0);
}

export type ViewMode = 'overall' | 'liquid' | 'investable';

/**
 * Filter categories by view mode.
 */
function filterByViewMode(categories: Category[], viewMode: ViewMode): Category[] {
  if (viewMode === 'overall') return categories;
  if (viewMode === 'liquid') return categories.filter(c => c.isLiquid);
  if (viewMode === 'investable') return categories.filter(c => c.isInvestable);
  return categories;
}

export interface NetWorthBreakdown {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  categoryTotals: Record<string, number>; // categoryId -> baseValue
}

/**
 * Primary calculation: derives net worth from a snapshot.
 */
export function calcNetWorth(
  snapshot: Snapshot,
  baseCurrency: string,
  viewMode: ViewMode = 'overall'
): NetWorthBreakdown {
  const { categories, exchangeRates } = snapshot;
  const filtered = filterByViewMode(categories, viewMode);

  const categoryTotals: Record<string, number> = {};
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const cat of filtered) {
    const total = calcCategoryTotal(cat, baseCurrency, exchangeRates);
    categoryTotals[cat.id] = total;
    if (cat.type === 'asset') totalAssets += total;
    else totalLiabilities += total;
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    categoryTotals,
  };
}

/**
 * Build a 12-month trend dataset from an array of snapshots.
 */
export interface TrendPoint {
  month: string;   // "Jan '26"
  netWorth: number;
  assets: number;
  liabilities: number;
}

export function buildTrendData(
  snapshots: Snapshot[],
  baseCurrency: string,
  viewMode: ViewMode = 'overall'
): TrendPoint[] {
  return snapshots
    .slice(-12)
    // Sort by raw YYYY-MM string BEFORE formatting — alphabetical label sort ("Apr '26") is wrong
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(snap => {
      const { totalAssets, totalLiabilities, netWorth } = calcNetWorth(snap, baseCurrency, viewMode);
      const [year, month] = snap.month.split('-');
      const date = new Date(Number(year), Number(month) - 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { month: label, netWorth, assets: totalAssets, liabilities: totalLiabilities };
    });
}

/**
 * Portfolio allocation — category breakdown for donut/bar chart.
 */
export interface AllocationItem {
  name: string;
  value: number;
  percentage: number;
  icon: string;
  type: 'asset' | 'liability';
}

export function buildAllocationData(
  snapshot: Snapshot,
  baseCurrency: string
): AllocationItem[] {
  const { categories, exchangeRates } = snapshot;
  const items: AllocationItem[] = [];

  const totalAssets = categories
    .filter(c => c.type === 'asset')
    .reduce((sum, c) => sum + calcCategoryTotal(c, baseCurrency, exchangeRates), 0);

  for (const cat of categories) {
    const value = calcCategoryTotal(cat, baseCurrency, exchangeRates);
    if (value <= 0) continue;
    const base = cat.type === 'asset' ? totalAssets : 1; // liabilities shown separately
    items.push({
      name: cat.name,
      value,
      percentage: base > 0 ? (value / base) * 100 : 0,
      icon: cat.icon,
      type: cat.type,
    });
  }

  return items.sort((a, b) => b.value - a.value);
}

/**
 * Month-over-month change calculations.
 */
export function calcMonthChange(
  current: Snapshot,
  previous: Snapshot | undefined,
  baseCurrency: string
): { change: number; changePercent: number } {
  if (!previous) return { change: 0, changePercent: 0 };
  const curr = calcNetWorth(current, baseCurrency).netWorth;
  const prev = calcNetWorth(previous, baseCurrency).netWorth;
  const change = curr - prev;
  const changePercent = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0;
  return { change, changePercent };
}
