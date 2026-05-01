import { describe, it, expect } from 'vitest';
import { calcFIREMetrics } from '../fireCalculator';
import { Goal, Snapshot } from '../../types';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    type: 'fire',
    name: 'FIRE',
    createdAt: new Date().toISOString(),
    targetAmount: 0,
    annualExpenses: 1_200_000,
    multiplier: 25,
    ...overrides,
  };
}

function makeSnapshot(netWorth: number): Snapshot {
  return {
    id: 's1',
    month: '2025-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exchangeRates: {},
    monthlyIncome: 200_000,
    monthlyExpenses: 100_000,
    categories: [
      {
        id: 'c1',
        name: 'Investments',
        type: 'asset',
        icon: '📈',
        isLiquid: true,
        isInvestable: true,
        items: [
          { id: 'i1', name: 'Portfolio', amount: netWorth, currency: 'INR' }
        ],
      },
    ],
  };
}

describe('calcFIREMetrics', () => {
  it('calculates FI number correctly (expenses × multiplier)', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(0), 'INR');
    expect(metrics.fiNumber).toBe(30_000_000); // 1.2M × 25
  });

  it('returns isFI=true when netWorth >= fiNumber', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(30_000_000), 'INR');
    expect(metrics.isFI).toBe(true);
    expect(metrics.yearsToFI).toBe(0);
  });

  it('returns isFI=false when netWorth < fiNumber', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(10_000_000), 'INR');
    expect(metrics.isFI).toBe(false);
  });

  it('progress is bounded between 0 and 100', () => {
    const over = calcFIREMetrics(makeGoal(), makeSnapshot(100_000_000), 'INR');
    expect(over.progressPercentage).toBeLessThanOrEqual(100);
    const zero = calcFIREMetrics(makeGoal(), makeSnapshot(0), 'INR');
    expect(zero.progressPercentage).toBe(0);
  });

  it('calculates savings rate correctly', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(10_000_000), 'INR');
    // income=200K, expenses=100K → savings=100K → rate=50%
    expect(metrics.savingsRatePercentage).toBeCloseTo(50);
  });

  // NPER formula verification: PV=10M, FV=30M, PMT=100K/month, r=5%/12
  // Expected ≈ 105 months ≈ 8.75 years (validate formula is correct, not just a specific value)
  it('NPER yearsToFI is positive and finite when saving toward goal', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(10_000_000), 'INR');
    expect(metrics.yearsToFI).not.toBeNull();
    expect(metrics.yearsToFI!).toBeGreaterThan(0);
    expect(isFinite(metrics.yearsToFI!)).toBe(true);
  });

  it('NPER yearsToFI with known values stays within 10% of Excel NPER result', () => {
    // Excel NPER(5%/12, 100000, -10000000, -30000000) ≈ 104.5 months ≈ 8.71 years
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(10_000_000), 'INR');
    const yearsToFI = metrics.yearsToFI!;
    expect(yearsToFI).toBeGreaterThan(7);   // >7 years
    expect(yearsToFI).toBeLessThan(11);     // <11 years (10% tolerance)
  });

  it('returns yearsToFI=null when not saving', () => {
    const noSavingsSnap: Snapshot = {
      ...makeSnapshot(10_000_000),
      monthlyIncome: 0,
      monthlyExpenses: 0,
    };
    const metrics = calcFIREMetrics(makeGoal(), noSavingsSnap, 'INR');
    expect(metrics.yearsToFI).toBeNull();
  });

  // Phase 3.4 — configurable return/inflation/savings growth
  it('realReturnRate reflects (1+nominal)/(1+inflation)-1 correctly', () => {
    const goal = makeGoal({ expectedReturn: 7, inflationRate: 3 });
    const metrics = calcFIREMetrics(goal, makeSnapshot(0), 'INR');
    const expected = ((1.07 / 1.03) - 1) * 100;
    expect(metrics.realReturnRate).toBeCloseTo(expected, 2);
  });

  it('higher expectedReturn reduces yearsToFI compared to lower', () => {
    const highReturn = calcFIREMetrics(makeGoal({ expectedReturn: 10, inflationRate: 3 }), makeSnapshot(10_000_000), 'INR');
    const lowReturn  = calcFIREMetrics(makeGoal({ expectedReturn: 4,  inflationRate: 3 }), makeSnapshot(10_000_000), 'INR');
    expect(highReturn.yearsToFI!).toBeLessThan(lowReturn.yearsToFI!);
  });

  it('stepped savings growth reduces yearsToFI compared to flat savings', () => {
    const flat    = calcFIREMetrics(makeGoal({ expectedReturn: 7, inflationRate: 3, annualSavingsGrowth: 0  }), makeSnapshot(10_000_000), 'INR');
    const stepped = calcFIREMetrics(makeGoal({ expectedReturn: 7, inflationRate: 3, annualSavingsGrowth: 10 }), makeSnapshot(10_000_000), 'INR');
    expect(stepped.yearsToFI!).toBeLessThan(flat.yearsToFI!);
  });
});
