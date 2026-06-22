import { describe, it, expect } from 'vitest';
import { monthEndDate, annualisedReturn, buildAccountReturns } from '../returns';
import type { Snapshot } from '../../types';

describe('monthEndDate', () => {
  it('returns the last calendar day of the month', () => {
    expect(monthEndDate('2026-06').getDate()).toBe(30);
    expect(monthEndDate('2026-02').getDate()).toBe(28);
    expect(monthEndDate('2024-02').getDate()).toBe(29); // leap year
    expect(monthEndDate('2026-01').getMonth()).toBe(0);
  });
});

describe('annualisedReturn', () => {
  const asOf = monthEndDate('2026-06');

  it('returns null without a complete cost basis', () => {
    expect(annualisedReturn(undefined, '2025-06-01', 110, asOf)).toBeNull();
    expect(annualisedReturn(100, undefined, 110, asOf)).toBeNull();
    expect(annualisedReturn(0, '2025-06-01', 110, asOf)).toBeNull();
    expect(annualisedReturn(100, '2025-06-01', 0, asOf)).toBeNull();
  });

  it('returns null when the purchase is on/after the as-of date', () => {
    expect(annualisedReturn(100, '2026-06-30', 110, asOf)).toBeNull();
    expect(annualisedReturn(100, '2027-01-01', 110, asOf)).toBeNull();
  });

  it('computes ~10% for a 10% gain held one year', () => {
    const r = annualisedReturn(100, '2025-06-30', 110, asOf);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.095);
    expect(r!).toBeLessThan(0.105);
  });

  it('returns a negative rate for a loss', () => {
    const r = annualisedReturn(100, '2025-06-30', 80, asOf);
    expect(r!).toBeLessThan(0);
  });
});

describe('buildAccountReturns', () => {
  function snap(): Snapshot {
    return {
      id: 's1', month: '2026-06', createdAt: '', updatedAt: '',
      exchangeRates: { USD: 80 },
      categories: [{
        id: 'c1', name: 'Equity', type: 'asset', icon: '📈', isLiquid: true, isInvestable: true,
        items: [
          { id: 'i1', name: 'Index Fund', amount: 150000, currency: 'INR', purchasePrice: 100000, purchaseDate: '2024-06-30' },
          { id: 'i2', name: 'No Cost Basis', amount: 50000, currency: 'INR' },
          { id: 'i3', name: 'Home Loan', amount: 4000000, currency: 'INR', purchasePrice: 5000000, purchaseDate: '2020-01-01', loanPrincipal: 5000000, annualInterestRate: 8.5, tenureMonths: 240, loanStartMonth: '2020-01' },
        ],
      }],
    };
  }

  it('includes only accounts with a cost basis, skipping loans', () => {
    const rows = buildAccountReturns(snap(), 'INR');
    expect(rows).toHaveLength(1);
    expect(rows[0].account).toBe('Index Fund');
  });

  it('reports total and annualised return for a 2-year 50% gain', () => {
    const [row] = buildAccountReturns(snap(), 'INR');
    expect(row.totalReturnPct).toBeCloseTo(50, 1);
    // 50% over ~2 years annualises to ~22.5%
    expect(row.annualisedReturnPct!).toBeGreaterThan(20);
    expect(row.annualisedReturnPct!).toBeLessThan(25);
    expect(row.unrealisedGainBase).toBe(50000);
  });
});
