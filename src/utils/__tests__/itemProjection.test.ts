import { describe, it, expect } from 'vitest';
import { projectItemValue, buildFireProjection } from '../itemProjection';
import { calcNetWorthForGoal } from '../calculations';
import { Goal, Snapshot, LineItem, Category } from '../../types';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', type: 'fire', name: 'FIRE', createdAt: new Date().toISOString(),
    targetAmount: 0, expectedReturn: 7, inflationRate: 3, ...overrides,
  };
}

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 's1', month: '2025-01', createdAt: '', updatedAt: '',
    exchangeRates: {}, categories: [], ...overrides,
  };
}

function asset(items: LineItem[]): Category {
  return { id: 'inv', name: 'Investments', type: 'asset', icon: '📈', isLiquid: true, isInvestable: true, items };
}

describe('projectItemValue', () => {
  const asOf = new Date(2025, 0, 31);
  const oneYearLater = new Date(2026, 0, 31);

  it('holds an item with no stated rate and no cost basis FLAT — never backfills the blended rate', () => {
    const item: LineItem = { id: 'a', name: 'Savings', amount: 1000, currency: 'INR' };
    expect(projectItemValue(item, 'asset', asOf, oneYearLater)).toBe(1000);
  });

  it('compounds a stated-rate item at its own rate', () => {
    const item: LineItem = { id: 'a', name: 'FD', amount: 1000, currency: 'INR', statedReturnRate: 10 };
    const result = projectItemValue(item, 'asset', asOf, oneYearLater);
    expect(result).toBeCloseTo(1100, 0); // ~10% over ~1 year
  });

  it('amortises a loan-backed liability via calculateOutstandingBalance, ignoring statedReturnRate', () => {
    const item: LineItem = {
      id: 'a', name: 'Home Loan', amount: 1000, currency: 'INR',
      loanPrincipal: 1000, annualInterestRate: 8, tenureMonths: 12, loanStartMonth: '2025-01',
    };
    const result = projectItemValue(item, 'liability', asOf, oneYearLater);
    expect(result).toBeLessThan(1000); // paid down over the year
  });

  it('holds a liability with incomplete loan config FLAT — no shrink assumption', () => {
    const item: LineItem = { id: 'a', name: 'Credit Card', amount: 500, currency: 'INR' };
    expect(projectItemValue(item, 'liability', asOf, oneYearLater)).toBe(500);
  });

  it('is a no-op when target is not after asOf', () => {
    const item: LineItem = { id: 'a', name: 'FD', amount: 1000, currency: 'INR', statedReturnRate: 10 };
    expect(projectItemValue(item, 'asset', asOf, asOf)).toBe(1000);
  });
});

describe('buildFireProjection', () => {
  it('point 0 (perItem) matches calcNetWorthForGoal exactly — same scope, same starting value', () => {
    const snap = makeSnapshot({
      monthlyIncome: 100_000, monthlyExpenses: 60_000,
      categories: [asset([
        { id: 'a', name: 'FD', amount: 100_000, currency: 'INR', statedReturnRate: 7 },
        { id: 'b', name: 'Savings', amount: 50_000, currency: 'INR' }, // unrated
      ])],
    });
    const goal = makeGoal({ targetDate: '2027-01-31' });
    const { points } = buildFireProjection(snap, goal, 'INR');
    const expected = calcNetWorthForGoal(snap, 'INR', goal.excludedCategoryIds ?? [], 'investable');
    expect(points[0].perItem).toBe(Math.round(expected));
  });

  it('flags hasUnratedItems when an in-scope asset item has no rate signal', () => {
    const snap = makeSnapshot({ categories: [asset([{ id: 'a', name: 'Savings', amount: 1000, currency: 'INR' }])] });
    const { hasUnratedItems } = buildFireProjection(snap, makeGoal({ targetDate: '2026-01-31' }), 'INR');
    expect(hasUnratedItems).toBe(true);
  });

  it('does not flag hasUnratedItems when every in-scope item has a rate', () => {
    const snap = makeSnapshot({ categories: [asset([{ id: 'a', name: 'FD', amount: 1000, currency: 'INR', statedReturnRate: 7 }])] });
    const { hasUnratedItems } = buildFireProjection(snap, makeGoal({ targetDate: '2026-01-31' }), 'INR');
    expect(hasUnratedItems).toBe(false);
  });

  it('perItem grows over time for a fully-rated portfolio with no unrated drag', () => {
    const snap = makeSnapshot({ categories: [asset([{ id: 'a', name: 'FD', amount: 100_000, currency: 'INR', statedReturnRate: 10 }])] });
    const { points } = buildFireProjection(snap, makeGoal({ targetDate: '2027-01-31' }), 'INR');
    expect(points[points.length - 1].perItem).toBeGreaterThan(points[0].perItem);
  });

  it('falls back to a 20-year (240-month) horizon when the goal has no targetDate', () => {
    const snap = makeSnapshot({ categories: [asset([{ id: 'a', name: 'FD', amount: 1000, currency: 'INR' }])] });
    const { points } = buildFireProjection(snap, makeGoal(), 'INR');
    expect(points.length).toBe(241); // month 0 through month 240 inclusive
  });

  it('caps the horizon at 600 months even for a far-future targetDate', () => {
    const snap = makeSnapshot({ categories: [asset([{ id: 'a', name: 'FD', amount: 1000, currency: 'INR' }])] });
    const { points } = buildFireProjection(snap, makeGoal({ targetDate: '2100-01-31' }), 'INR');
    expect(points.length).toBe(601);
  });

  it('blended line contributes monthly savings and compounds — matches the sign of a positive savings rate', () => {
    const snap = makeSnapshot({
      monthlyIncome: 100_000, monthlyExpenses: 50_000,
      categories: [asset([{ id: 'a', name: 'Portfolio', amount: 1_000_000, currency: 'INR' }])],
    });
    const { points } = buildFireProjection(snap, makeGoal({ targetDate: '2026-01-31' }), 'INR');
    expect(points[points.length - 1].blended).toBeGreaterThan(points[0].blended);
  });
});
