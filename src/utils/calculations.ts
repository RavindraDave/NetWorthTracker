import { Snapshot, Category, ViewMode } from '../types';

/**
 * Fixed anchor currency. All exchange rates are stored as "1 USD = X currency".
 * USD itself is never stored in exchangeRates (implicitly = 1).
 */
export const RATE_ANCHOR = 'USD';

export function anchorRate(currency: string, exchangeRates: Record<string, number>): number {
  if (currency === RATE_ANCHOR) return 1;
  const rate = exchangeRates[currency];
  if (!rate || rate <= 0) return 0; // 0 signals missing rate to caller
  return rate;
}

/**
 * Convert an amount from one currency to another using anchor-relative rates.
 * rates["INR"] = 83 means "1 USD = 83 INR". USD is the implicit anchor (= 1).
 */
export function convertToBase(
  amount: number,
  currency: string,
  baseCurrency: string,
  exchangeRates: Record<string, number>
): number {
  if (currency === baseCurrency) return amount;
  const fromRate = anchorRate(currency, exchangeRates);
  const toRate = anchorRate(baseCurrency, exchangeRates);
  if (fromRate <= 0 || toRate <= 0) {
    console.warn(`[WealthPulse] Missing anchor rate for ${fromRate <= 0 ? currency : baseCurrency}. Falling back to 1:1.`);
    return amount;
  }
  return amount * toRate / fromRate;
}

/**
 * Calculate total for a category in base currency.
 */
export function calcCategoryTotal(
  category: Category,
  baseCurrency: string,
  exchangeRates: Record<string, number>,
  forGoals = false
): number {
  return category.items
    .filter(item => !item.excludeFromNetWorth && !(forGoals && item.excludeFromGoals))
    .reduce((sum, item) => sum + convertToBase(item.amount, item.currency, baseCurrency, exchangeRates), 0);
}

/**
 * Returns currencies used by included line items that have no valid
 * exchange rate to baseCurrency, meaning their values are silently
 * falling back to a 1:1 conversion in calcNetWorth.
 */
export function getMissingRateCurrencies(snapshot: Snapshot, baseCurrency: string): string[] {
  const { categories, exchangeRates } = snapshot;
  const missing = new Set<string>();

  for (const cat of categories) {
    for (const item of cat.items) {
      if (item.excludeFromNetWorth) continue;
      if (item.currency === baseCurrency) continue;
      if (item.currency === RATE_ANCHOR) continue; // USD is the implicit anchor, always rate = 1
      const rate = exchangeRates[item.currency];
      if (!rate || rate <= 0) missing.add(item.currency);
    }
  }

  return Array.from(missing);
}

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
 * Net worth for goal progress — supports both an optional view-mode filter
 * (liquid/investable) AND an optional per-goal category exclusion list.
 * When both are specified the view-mode filter runs first, then exclusions.
 */
export function calcNetWorthForGoal(
  snapshot: Snapshot,
  baseCurrency: string,
  excludedCategoryIds: string[] = [],
  viewMode: ViewMode = 'overall'
): number {
  const { categories, exchangeRates } = snapshot;
  const excluded = new Set(excludedCategoryIds);
  const filtered = filterByViewMode(categories, viewMode);
  let assets = 0;
  let liabilities = 0;
  for (const cat of filtered) {
    if (excluded.has(cat.id)) continue;
    const total = calcCategoryTotal(cat, baseCurrency, exchangeRates, true);
    if (cat.type === 'asset') assets += total;
    else liabilities += total;
  }
  return assets - liabilities;
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

  const totalLiabilities = categories
    .filter(c => c.type === 'liability')
    .reduce((sum, c) => sum + calcCategoryTotal(c, baseCurrency, exchangeRates), 0);

  for (const cat of categories) {
    const value = calcCategoryTotal(cat, baseCurrency, exchangeRates);
    if (value <= 0) continue;
    const base = cat.type === 'asset' ? totalAssets : totalLiabilities;
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
 * Portfolio allocation grouped by currency denomination (for multi-currency portfolios).
 * Only counts asset line items not excluded from net worth.
 */
export function buildCurrencyAllocationData(
  snapshot: Snapshot,
  baseCurrency: string,
): AllocationItem[] {
  const { categories, exchangeRates } = snapshot;
  const totals: Record<string, number> = {};

  for (const cat of categories) {
    if (cat.type !== 'asset') continue;
    for (const item of cat.items) {
      if (item.excludeFromNetWorth) continue;
      const base = convertToBase(item.amount, item.currency, baseCurrency, exchangeRates);
      totals[item.currency] = (totals[item.currency] ?? 0) + base;
    }
  }

  const totalAssets = Object.values(totals).reduce((a, b) => a + b, 0);

  return Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([currency, value]) => ({
      name: currency,
      value: Math.round(value),
      percentage: totalAssets > 0 ? (value / totalAssets) * 100 : 0,
      icon: '',
      type: 'asset' as const,
    }));
}

/**
 * Build a 12-month value trend for a single category, matched first by ID then by name.
 */
export interface CategoryTrendPoint {
  month: string;
  value: number;
}

export function buildCategoryTrendData(
  snapshots: Snapshot[],
  baseCurrency: string,
  categoryId: string,
  categoryName: string,
): CategoryTrendPoint[] {
  return snapshots
    .slice(-12)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(snap => {
      const cat = snap.categories.find(c => c.id === categoryId)
               ?? snap.categories.find(c => c.name === categoryName);
      const value = cat
        ? Math.round(calcCategoryTotal(cat, baseCurrency, snap.exchangeRates))
        : 0;
      const [year, month] = snap.month.split('-');
      const date = new Date(Number(year), Number(month) - 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { month: label, value };
    });
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

/** Savings rate as a percentage (0–100). Returns 0 when income is zero or negative. */
export function calcSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  return ((income - expenses) / income) * 100;
}

/**
 * Average monthly income/expenses over the last `windowMonths` snapshots that
 * actually carry cash-flow data (a bonus month or a forgotten field would
 * otherwise skew a FIRE projection built on a single month). Returns null
 * when no snapshot has cash-flow data.
 */
export function avgMonthlyCashflow(
  snapshots: Snapshot[],
  windowMonths: number
): { income: number; expenses: number } | null {
  const recent = [...snapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .filter(s => (s.monthlyIncome ?? 0) > 0 || (s.monthlyExpenses ?? 0) > 0)
    .slice(-Math.max(1, windowMonths));
  if (recent.length === 0) return null;
  return {
    income:   recent.reduce((sum, s) => sum + (s.monthlyIncome   ?? 0), 0) / recent.length,
    expenses: recent.reduce((sum, s) => sum + (s.monthlyExpenses ?? 0), 0) / recent.length,
  };
}
