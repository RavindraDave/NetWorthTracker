import { describe, it, expect } from 'vitest';
import { monthEndDate, annualisedReturn, buildAccountReturns, itemReturnPct } from '../returns';
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

describe('itemReturnPct', () => {
  const asOf = monthEndDate('2026-06');

  it('prefers a stated rate over computed CAGR', () => {
    expect(itemReturnPct({ id: 'x', name: 'FD', amount: 105000, currency: 'INR', statedReturnRate: 5, purchasePrice: 100000, purchaseDate: '2024-06-30' }, asOf)).toBe(5);
  });

  it('falls back to CAGR when no stated rate', () => {
    const r = itemReturnPct({ id: 'x', name: 'MF', amount: 110000, currency: 'INR', purchasePrice: 100000, purchaseDate: '2025-06-30' }, asOf);
    expect(r!).toBeGreaterThan(9);
    expect(r!).toBeLessThan(11);
  });

  it('returns undefined for a plain current account', () => {
    expect(itemReturnPct({ id: 'x', name: 'Savings', amount: 50000, currency: 'INR' }, asOf)).toBeUndefined();
  });
});

describe('buildAccountReturns', () => {
  function snap(): Snapshot {
    return {
      id: 's1', month: '2026-06', createdAt: '', updatedAt: '',
      exchangeRates: { USD: 80 },
      categories: [{
        id: 'c1', name: 'Portfolio', type: 'asset', icon: '📈', isLiquid: true, isInvestable: true,
        items: [
          { id: 'i1', name: 'Index Fund', amount: 150000, currency: 'INR', purchasePrice: 100000, purchaseDate: '2024-06-30' },
          { id: 'i2', name: 'Savings A/C', amount: 50000, currency: 'INR', statedReturnRate: 1 },
          { id: 'i3', name: 'Bank FD', amount: 200000, currency: 'INR', statedReturnRate: 5 },
          { id: 'i4', name: 'Current A/C', amount: 30000, currency: 'INR' },
          { id: 'i5', name: 'Home Loan', amount: 4000000, currency: 'INR', purchasePrice: 5000000, purchaseDate: '2020-01-01', loanPrincipal: 5000000, annualInterestRate: 8.5, tenureMonths: 240, loanStartMonth: '2020-01' },
        ],
      }],
    };
  }

  it('includes stated-rate and cost-basis accounts, skipping bare accounts and loans', () => {
    const rows = buildAccountReturns(snap(), 'INR');
    expect(rows.map(r => r.account)).toEqual(['Index Fund', 'Savings A/C', 'Bank FD']);
  });

  it('reports stated yields verbatim with a Stated basis', () => {
    const fd = buildAccountReturns(snap(), 'INR').find(r => r.account === 'Bank FD')!;
    expect(fd.returnRatePct).toBe(5);
    expect(fd.basis).toBe('Stated');
    expect(fd.totalReturnPct).toBeUndefined(); // no cost basis
  });

  it('measures CAGR for market holdings with a CAGR basis', () => {
    const fund = buildAccountReturns(snap(), 'INR').find(r => r.account === 'Index Fund')!;
    expect(fund.basis).toBe('CAGR');
    expect(fund.totalReturnPct).toBeCloseTo(50, 1);
    expect(fund.returnRatePct).toBeGreaterThan(20); // ~22.5% over 2y
    expect(fund.returnRatePct).toBeLessThan(25);
    expect(fund.unrealisedGainBase).toBe(50000);
  });
});
