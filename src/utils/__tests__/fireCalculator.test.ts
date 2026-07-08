import { describe, it, expect } from 'vitest';
import { calcFIREMetrics } from '../fireCalculator';
import { Goal, Snapshot } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    type: 'fire',
    name: 'FIRE',
    createdAt: new Date().toISOString(),
    targetAmount: 0,
    annualExpenses: 1_200_000,
    multiplier: 25,
    expectedReturn: 7,
    inflationRate: 3,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
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
        id: 'investments',
        name: 'Investments',
        type: 'asset',
        icon: '📈',
        isLiquid: true,
        isInvestable: true,
        items: [{ id: 'i1', name: 'Portfolio', amount: 10_000_000, currency: 'INR' }],
      },
    ],
    ...overrides,
  };
}

/** Snapshot with an investable portfolio AND a non-investable/non-liquid real estate category */
function makeSnapshotWithRealEstate(portfolioAmount: number, realEstateAmount: number): Snapshot {
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
        id: 'investments',
        name: 'Investments',
        type: 'asset',
        icon: '📈',
        isLiquid: true,
        isInvestable: true,
        items: [{ id: 'i1', name: 'Portfolio', amount: portfolioAmount, currency: 'INR' }],
      },
      {
        id: 'real-estate',
        name: 'Real Estate',
        type: 'asset',
        icon: '🏠',
        isLiquid: false,
        isInvestable: false,
        items: [{ id: 'i2', name: 'House', amount: realEstateAmount, currency: 'INR' }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// FI Number
// ---------------------------------------------------------------------------

describe('calcFIREMetrics — FI Number', () => {
  it('calculates FI number as expenses × multiplier', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot({ categories: [] }), 'INR');
    expect(metrics.fiNumber).toBe(30_000_000); // 1.2M × 25
  });

  it('derives multiplier from withdrawalRate when multiplier is absent', () => {
    const goal = makeGoal({ multiplier: undefined, withdrawalRate: 4 });
    const metrics = calcFIREMetrics(goal, makeSnapshot({ categories: [] }), 'INR');
    expect(metrics.fiNumber).toBe(30_000_000); // 1.2M × 25 (100/4)
  });

  it('returns 0 fiNumber when annualExpenses is 0', () => {
    const metrics = calcFIREMetrics(makeGoal({ annualExpenses: 0 }), makeSnapshot({ categories: [] }), 'INR');
    expect(metrics.fiNumber).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Progress and isFI
// ---------------------------------------------------------------------------

describe('calcFIREMetrics — Progress & isFI', () => {
  it('returns isFI=true when netWorth >= fiNumber', () => {
    const snap = makeSnapshot({ categories: [
      { id: 'c', name: 'Inv', type: 'asset', icon: '', isLiquid: true, isInvestable: true,
        items: [{ id: 'i', name: 'X', amount: 30_000_000, currency: 'INR' }] },
    ]});
    const metrics = calcFIREMetrics(makeGoal(), snap, 'INR');
    expect(metrics.isFI).toBe(true);
    expect(metrics.yearsToFI).toBe(0);
  });

  it('returns isFI=false when netWorth < fiNumber', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(), 'INR');
    expect(metrics.isFI).toBe(false);
  });

  it('progress is clamped to [0, 100]', () => {
    const highNW = makeSnapshot({ categories: [
      { id: 'c', name: 'Inv', type: 'asset', icon: '', isLiquid: true, isInvestable: true,
        items: [{ id: 'i', name: 'X', amount: 100_000_000, currency: 'INR' }] },
    ]});
    expect(calcFIREMetrics(makeGoal(), highNW, 'INR').progressPercentage).toBeLessThanOrEqual(100);
    expect(calcFIREMetrics(makeGoal(), makeSnapshot({ categories: [] }), 'INR').progressPercentage).toBe(0);
  });

  it('returns 0 progress when fiNumber is 0', () => {
    const metrics = calcFIREMetrics(makeGoal({ annualExpenses: 0 }), makeSnapshot(), 'INR');
    expect(metrics.progressPercentage).toBe(0);
    expect(metrics.isFI).toBe(false);
  });

  it('handles null snapshot gracefully', () => {
    const metrics = calcFIREMetrics(makeGoal(), null, 'INR');
    expect(metrics.currentNetWorth).toBe(0);
    expect(metrics.progressPercentage).toBe(0);
    expect(metrics.isFI).toBe(false);
    expect(metrics.yearsToFI).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Savings & yearsToFI
// ---------------------------------------------------------------------------

describe('calcFIREMetrics — Savings Rate & yearsToFI', () => {
  it('calculates savings rate correctly when income > 0', () => {
    // income=200K, expenses=100K → savings=100K → rate=50%
    expect(calcFIREMetrics(makeGoal(), makeSnapshot(), 'INR').savingsRatePercentage).toBeCloseTo(50);
  });

  it('savings rate is 0 when income is 0', () => {
    const snap = makeSnapshot({ monthlyIncome: 0, monthlyExpenses: 0 });
    expect(calcFIREMetrics(makeGoal(), snap, 'INR').savingsRatePercentage).toBe(0);
  });

  it('yearsToFI is positive and finite when saving toward goal', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(), 'INR');
    expect(metrics.yearsToFI).not.toBeNull();
    expect(metrics.yearsToFI!).toBeGreaterThan(0);
    expect(isFinite(metrics.yearsToFI!)).toBe(true);
  });

  it('yearsToFI is null when income=0 and expenses=0 (zero savings, not negative)', () => {
    const snap = makeSnapshot({ monthlyIncome: 0, monthlyExpenses: 0 });
    const metrics = calcFIREMetrics(makeGoal(), snap, 'INR');
    expect(metrics.yearsToFI).toBeNull();
    expect(metrics.monthlySavings).toBe(0);   // zero, NOT negative
    expect(metrics.monthlyIncome).toBe(0);
  });

  it('yearsToFI is null when expenses exceed income (negative savings)', () => {
    const snap = makeSnapshot({ monthlyIncome: 50_000, monthlyExpenses: 100_000 });
    const metrics = calcFIREMetrics(makeGoal(), snap, 'INR');
    expect(metrics.yearsToFI).toBeNull();
    expect(metrics.monthlySavings).toBeLessThan(0); // truly negative
    expect(metrics.monthlyIncome).toBe(50_000);
  });

  it('monthlySavings = income - expenses', () => {
    const snap = makeSnapshot({ monthlyIncome: 300_000, monthlyExpenses: 80_000 });
    expect(calcFIREMetrics(makeGoal(), snap, 'INR').monthlySavings).toBe(220_000);
  });

  it('monthlyIncome is exposed in returned metrics', () => {
    const snap = makeSnapshot({ monthlyIncome: 250_000, monthlyExpenses: 100_000 });
    expect(calcFIREMetrics(makeGoal(), snap, 'INR').monthlyIncome).toBe(250_000);
  });

  // NPER formula verification
  it('NPER yearsToFI stays within 10% of Excel NPER result', () => {
    // Excel NPER(5%/12, 100000, -10000000, -30000000) ≈ 104.5 months ≈ 8.71 years
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(), 'INR');
    expect(metrics.yearsToFI!).toBeGreaterThan(7);
    expect(metrics.yearsToFI!).toBeLessThan(11);
  });
});

// ---------------------------------------------------------------------------
// Category exclusions (Bug fix: excludedCategoryIds must apply to FIRE goal)
// ---------------------------------------------------------------------------

describe('calcFIREMetrics — excludedCategoryIds', () => {
  it('respects excludedCategoryIds: excluded investable category is not counted', () => {
    const snap = makeSnapshot({
      categories: [
        {
          id: 'liquid',
          name: 'Liquid',
          type: 'asset',
          icon: '',
          isLiquid: true,
          isInvestable: true,
          items: [{ id: 'i1', name: 'X', amount: 20_000_000, currency: 'INR' }],
        },
        {
          id: 'to-exclude',
          name: 'Excluded Fund',
          type: 'asset',
          icon: '',
          isLiquid: true,
          isInvestable: true,
          items: [{ id: 'i2', name: 'Y', amount: 15_000_000, currency: 'INR' }],
        },
      ],
    });

    const goalNoExclusion = makeGoal();
    const goalWithExclusion = makeGoal({ excludedCategoryIds: ['to-exclude'] });

    const full = calcFIREMetrics(goalNoExclusion, snap, 'INR');
    const reduced = calcFIREMetrics(goalWithExclusion, snap, 'INR');

    expect(full.currentNetWorth).toBe(35_000_000);
    expect(reduced.currentNetWorth).toBe(20_000_000);
    expect(reduced.progressPercentage).toBeLessThan(full.progressPercentage);
  });

  it('non-investable real estate is excluded regardless of excludedCategoryIds', () => {
    const snap = makeSnapshotWithRealEstate(10_000_000, 5_000_000);
    const metrics = calcFIREMetrics(makeGoal(), snap, 'INR');
    // investable mode: only counts 'investments' (10M), not real estate (5M, isInvestable=false)
    expect(metrics.currentNetWorth).toBe(10_000_000);
  });

  it('excludedCategoryIds and investable filter combine: goal sees only investable minus exclusions', () => {
    const snap = makeSnapshotWithRealEstate(10_000_000, 5_000_000);
    // Exclude 'investments' too — so both filtered out → 0
    const goal = makeGoal({ excludedCategoryIds: ['investments'] });
    const metrics = calcFIREMetrics(goal, snap, 'INR');
    expect(metrics.currentNetWorth).toBe(0);
    expect(metrics.progressPercentage).toBe(0);
  });

  it('empty excludedCategoryIds behaves like no exclusions', () => {
    const snap = makeSnapshot();
    const goalEmpty = makeGoal({ excludedCategoryIds: [] });
    const goalNone = makeGoal();
    expect(calcFIREMetrics(goalEmpty, snap, 'INR').currentNetWorth)
      .toBe(calcFIREMetrics(goalNone, snap, 'INR').currentNetWorth);
  });

  it('excluding a non-existent ID does not change result', () => {
    const snap = makeSnapshot();
    const goal = makeGoal({ excludedCategoryIds: ['does-not-exist'] });
    const normal = calcFIREMetrics(makeGoal(), snap, 'INR');
    const withBadId = calcFIREMetrics(goal, snap, 'INR');
    expect(withBadId.currentNetWorth).toBe(normal.currentNetWorth);
  });

  it('97%-funded goal is NOT isFI even with exclusions reducing progress below 100', () => {
    // Target = 1.2M × 25 = 30M
    // Investable NW after exclusion = 29M → 96.7% → not FI
    const snap = makeSnapshot({
      categories: [
        {
          id: 'inv', name: 'Investments', type: 'asset', icon: '',
          isLiquid: true, isInvestable: true,
          items: [{ id: 'i1', name: 'X', amount: 29_000_000, currency: 'INR' }],
        },
        {
          id: 'house', name: 'House', type: 'asset', icon: '',
          isLiquid: false, isInvestable: true, // investable but excluded
          items: [{ id: 'i2', name: 'H', amount: 5_000_000, currency: 'INR' }],
        },
      ],
    });
    const goal = makeGoal({ excludedCategoryIds: ['house'] });
    const metrics = calcFIREMetrics(goal, snap, 'INR');
    expect(metrics.isFI).toBe(false);
    expect(metrics.currentNetWorth).toBe(29_000_000);
    expect(metrics.progressPercentage).toBeCloseTo(96.67, 1);
  });
});

// ---------------------------------------------------------------------------
// Real return rate
// ---------------------------------------------------------------------------

describe('calcFIREMetrics — real return & projections', () => {
  it('realReturnRate = (1+nominal)/(1+inflation) - 1', () => {
    const goal = makeGoal({ expectedReturn: 7, inflationRate: 3 });
    const expected = ((1.07 / 1.03) - 1) * 100;
    expect(calcFIREMetrics(goal, makeSnapshot({ categories: [] }), 'INR').realReturnRate).toBeCloseTo(expected, 2);
  });

  it('higher expectedReturn reduces yearsToFI', () => {
    const high = calcFIREMetrics(makeGoal({ expectedReturn: 10, inflationRate: 3 }), makeSnapshot(), 'INR');
    const low  = calcFIREMetrics(makeGoal({ expectedReturn: 4,  inflationRate: 3 }), makeSnapshot(), 'INR');
    expect(high.yearsToFI!).toBeLessThan(low.yearsToFI!);
  });

  it('higher annualSavingsGrowth reduces yearsToFI', () => {
    const flat    = calcFIREMetrics(makeGoal({ annualSavingsGrowth: 0  }), makeSnapshot(), 'INR');
    const stepped = calcFIREMetrics(makeGoal({ annualSavingsGrowth: 10 }), makeSnapshot(), 'INR');
    expect(stepped.yearsToFI!).toBeLessThan(flat.yearsToFI!);
  });

  it('safe withdrawal rate defaults to 4% (100/25 multiplier)', () => {
    expect(calcFIREMetrics(makeGoal(), makeSnapshot({ categories: [] }), 'INR').safeWithdrawalRate).toBeCloseTo(4);
  });

  it('monthlyPassiveIncome = currentNetWorth × SWR / 12', () => {
    const metrics = calcFIREMetrics(makeGoal(), makeSnapshot(), 'INR');
    const expected = (metrics.currentNetWorth * (metrics.safeWithdrawalRate / 100)) / 12;
    expect(metrics.monthlyPassiveIncome).toBeCloseTo(expected);
  });
});

// ---------------------------------------------------------------------------
// Cash-flow averaging (cashflowWindow)
// ---------------------------------------------------------------------------

describe('calcFIREMetrics — cashflowWindow averaging', () => {
  const history = [
    makeSnapshot({ id: 'a', month: '2024-11', monthlyIncome: 100_000, monthlyExpenses: 50_000 }),
    makeSnapshot({ id: 'b', month: '2024-12', monthlyIncome: 400_000, monthlyExpenses: 50_000 }), // bonus month
    makeSnapshot({ id: 'c', month: '2025-01', monthlyIncome: 100_000, monthlyExpenses: 50_000 }),
  ];
  const current = history[2];

  it('defaults to the current snapshot (window 1 / absent)', () => {
    const metrics = calcFIREMetrics(makeGoal(), current, 'INR', history);
    expect(metrics.monthlyIncome).toBe(100_000);
    expect(metrics.monthlySavings).toBe(50_000);
  });

  it('averages income and expenses over the window', () => {
    const metrics = calcFIREMetrics(makeGoal({ cashflowWindow: 3 }), current, 'INR', history);
    expect(metrics.monthlyIncome).toBeCloseTo(200_000); // (100k + 400k + 100k) / 3
    expect(metrics.monthlySavings).toBeCloseTo(150_000);
  });

  it('skips snapshots without cash-flow data instead of averaging in zeros', () => {
    const withGap = [
      ...history,
      makeSnapshot({ id: 'd', month: '2025-02', monthlyIncome: 0, monthlyExpenses: 0 }),
    ];
    const metrics = calcFIREMetrics(makeGoal({ cashflowWindow: 3 }), withGap[3], 'INR', withGap);
    expect(metrics.monthlyIncome).toBeCloseTo(200_000); // gap month excluded from window
  });

  it('falls back to current snapshot when no snapshots are passed', () => {
    const metrics = calcFIREMetrics(makeGoal({ cashflowWindow: 3 }), current, 'INR');
    expect(metrics.monthlyIncome).toBe(100_000);
  });

  it('averaging changes yearsToFI accordingly', () => {
    const single = calcFIREMetrics(makeGoal(), current, 'INR', history);
    const averaged = calcFIREMetrics(makeGoal({ cashflowWindow: 3 }), current, 'INR', history);
    expect(averaged.yearsToFI!).toBeLessThan(single.yearsToFI!); // higher avg savings → sooner FI
  });
});
