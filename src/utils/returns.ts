import { Snapshot, LineItem } from '../types';
import { calculateXIRR } from './xirr';
import { convertToBase } from './calculations';
import { subCategoryName } from './subCategories';

/** Last calendar day of a "YYYY-MM" month, as a Date (local time). */
export function monthEndDate(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0); // day 0 of next month = last day of this month
}

/**
 * Annualised return (CAGR) for a single lump-sum purchase held until `asOf`.
 *
 * This is point-to-point only — it does NOT model interim contributions
 * (SIPs, top-ups) or withdrawals. Returns null when cost basis is incomplete,
 * the holding period is non-positive, or the figure can't be computed.
 */
export function annualisedReturn(
  purchasePrice: number | undefined,
  purchaseDate: string | undefined,
  currentValue: number,
  asOf: Date,
): number | null {
  if (!purchasePrice || purchasePrice <= 0 || !purchaseDate || currentValue <= 0) return null;
  const pd = new Date(purchaseDate);
  if (pd >= asOf) return null;
  return calculateXIRR([
    { amount: -purchasePrice, date: pd },
    { amount: currentValue,   date: asOf },
  ]);
}

/**
 * A single account's headline annual return %, as a rounded percentage (e.g.
 * 5 or 9.4). Prefers a stated fixed yield; otherwise measures CAGR from cost
 * basis. Returns undefined when neither is available (e.g. a current account).
 */
export function itemReturnPct(item: LineItem, asOf: Date): number | undefined {
  if (typeof item.statedReturnRate === 'number' && item.statedReturnRate !== 0) {
    return item.statedReturnRate;
  }
  const cagr = annualisedReturn(item.purchasePrice, item.purchaseDate, item.amount, asOf);
  return cagr !== null ? parseFloat((cagr * 100).toFixed(1)) : undefined;
}

/** How an account's headline return rate was arrived at. */
export type ReturnBasis = 'Stated' | 'CAGR';

export interface AccountReturnRow {
  category: string;
  /** Sub-group within the category; absent when the item is ungrouped. */
  subCategory?: string;
  account: string;
  currency: string;
  currentValueBase: number;
  returnRatePct: number;       // headline annual return %
  basis: ReturnBasis;          // 'Stated' (known fixed yield) or 'CAGR' (measured)
  // Cost-basis detail — present only when a purchase price is recorded
  purchaseDate?: string;
  purchasePrice?: number;
  costBasisBase?: number;
  unrealisedGainBase?: number;
  totalReturnPct?: number;
}

/**
 * One return row per account (line item) for which a return rate can be
 * reported, evaluated against the given snapshot. An account qualifies when it
 * has either a stated yield (savings, FD, …) or a cost basis (market holdings).
 *
 * A stated rate always wins over a computed CAGR — it's the known, fixed figure
 * the user entered. Loan-backed liabilities are skipped: annualised return is
 * meaningless for them. Amounts are in base currency so the adviser can total
 * across holdings; percentages are currency-agnostic.
 */
export function buildAccountReturns(snapshot: Snapshot, baseCurrency: string): AccountReturnRow[] {
  const asOf = monthEndDate(snapshot.month);
  const rows: AccountReturnRow[] = [];

  for (const cat of snapshot.categories) {
    for (const item of cat.items) {
      const isLoan = !!(item.loanPrincipal && item.tenureMonths && item.loanStartMonth);
      if (isLoan) continue;

      const hasStated = typeof item.statedReturnRate === 'number' && item.statedReturnRate !== 0;
      const hasCostBasis = !!(item.purchasePrice && item.purchasePrice > 0);
      const cagr = hasCostBasis ? annualisedReturn(item.purchasePrice, item.purchaseDate, item.amount, asOf) : null;

      // Need a reportable rate: a stated yield, or a computable CAGR.
      if (!hasStated && cagr === null) continue;

      const currentValueBase = Math.round(convertToBase(item.amount, item.currency, baseCurrency, snapshot.exchangeRates));
      const row: AccountReturnRow = {
        category: cat.name,
        subCategory: subCategoryName(cat, item.subCategoryId),
        account: item.name,
        currency: item.currency,
        currentValueBase,
        returnRatePct: hasStated ? item.statedReturnRate! : parseFloat((cagr! * 100).toFixed(1)),
        basis: hasStated ? 'Stated' : 'CAGR',
      };

      if (hasCostBasis) {
        const costBasisBase = Math.round(convertToBase(item.purchasePrice!, item.currency, baseCurrency, snapshot.exchangeRates));
        row.purchaseDate = item.purchaseDate ?? '';
        row.purchasePrice = item.purchasePrice;
        row.costBasisBase = costBasisBase;
        row.unrealisedGainBase = currentValueBase - costBasisBase;
        row.totalReturnPct = parseFloat(((item.amount - item.purchasePrice!) / item.purchasePrice! * 100).toFixed(1));
      }

      rows.push(row);
    }
  }

  return rows;
}
