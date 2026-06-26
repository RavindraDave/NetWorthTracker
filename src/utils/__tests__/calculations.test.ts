import { describe, it, expect } from 'vitest';
import {
  convertToBase,
  calcCategoryTotal,
  calcNetWorth,
  calcNetWorthForGoal,
  buildTrendData,
  buildAllocationData,
  calcMonthChange,
  getMissingRateCurrencies,
  calcSavingsRate,
  anchorRate,
  RATE_ANCHOR,
} from '../calculations';
import { Snapshot, Category, LineItem } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCategory(overrides: Partial<Category> & { id: string; type: 'asset' | 'liability' }): Category {
  return {
    name: 'Test Category',
    icon: '📈',
    isLiquid: true,
    isInvestable: true,
    items: [],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  // Anchor-relative rates: "1 USD = X currency"
  return {
    id: 's1',
    month: '2025-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exchangeRates: { INR: 83, EUR: 0.92222, SGD: 1.33871 },
    categories: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// convertToBase
// ---------------------------------------------------------------------------

describe('convertToBase', () => {
  it('returns amount unchanged when currency equals baseCurrency', () => {
    expect(convertToBase(1000, 'INR', 'INR', {})).toBe(1000);
  });

  it('converts using exchange rate', () => {
    // Anchor-relative: { INR: 83 } means "1 USD = 83 INR"
    expect(convertToBase(100, 'USD', 'INR', { INR: 83 })).toBe(8300);
  });

  it('falls back to 1:1 when rate is missing', () => {
    expect(convertToBase(500, 'EUR', 'INR', {})).toBe(500);
  });

  it('falls back to 1:1 when rate is zero', () => {
    expect(convertToBase(500, 'EUR', 'INR', { EUR: 0 })).toBe(500);
  });

  it('falls back to 1:1 when rate is negative', () => {
    expect(convertToBase(500, 'EUR', 'INR', { EUR: -90 })).toBe(500);
  });

  it('handles zero amount', () => {
    expect(convertToBase(0, 'USD', 'INR', { INR: 83 })).toBe(0);
  });

  it('handles decimal amounts correctly', () => {
    expect(convertToBase(1.5, 'USD', 'INR', { INR: 83 })).toBeCloseTo(124.5);
  });
});

// ---------------------------------------------------------------------------
// calcCategoryTotal
// ---------------------------------------------------------------------------

describe('calcCategoryTotal', () => {
  it('sums items in base currency', () => {
    const cat = makeCategory({
      id: 'c1',
      type: 'asset',
      items: [
        { id: 'i1', name: 'A', amount: 1000, currency: 'INR' },
        { id: 'i2', name: 'B', amount: 100, currency: 'USD' },
      ],
    });
    expect(calcCategoryTotal(cat, 'INR', { INR: 83 })).toBe(9300);
  });

  it('returns 0 for empty category', () => {
    const cat = makeCategory({ id: 'c1', type: 'asset', items: [] });
    expect(calcCategoryTotal(cat, 'INR', {})).toBe(0);
  });

  it('skips items with excludeFromNetWorth=true', () => {
    const cat = makeCategory({
      id: 'c1',
      type: 'asset',
      items: [
        { id: 'i1', name: 'Included', amount: 1000, currency: 'INR' },
        { id: 'i2', name: 'Excluded', amount: 5000, currency: 'INR', excludeFromNetWorth: true },
      ],
    });
    expect(calcCategoryTotal(cat, 'INR', {})).toBe(1000);
  });

  it('includes items with excludeFromNetWorth=false', () => {
    const cat = makeCategory({
      id: 'c1',
      type: 'asset',
      items: [{ id: 'i1', name: 'Item', amount: 2000, currency: 'INR', excludeFromNetWorth: false }],
    });
    expect(calcCategoryTotal(cat, 'INR', {})).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// calcNetWorth
// ---------------------------------------------------------------------------

describe('calcNetWorth', () => {
  function makeFullSnapshot(): Snapshot {
    return makeSnapshot({
      categories: [
        makeCategory({
          id: 'liquid-asset',
          name: 'Cash',
          type: 'asset',
          isLiquid: true,
          isInvestable: true,
          items: [{ id: 'i1', name: 'Bank', amount: 500_000, currency: 'INR' }],
        }),
        makeCategory({
          id: 'non-liquid-asset',
          name: 'Real Estate',
          type: 'asset',
          isLiquid: false,
          isInvestable: false,
          items: [{ id: 'i2', name: 'House', amount: 5_000_000, currency: 'INR' }],
        }),
        makeCategory({
          id: 'liability',
          name: 'Home Loan',
          type: 'liability',
          isLiquid: false,
          isInvestable: false,
          items: [{ id: 'i3', name: 'Mortgage', amount: 2_000_000, currency: 'INR' }],
        }),
      ],
    });
  }

  it('overall mode: includes all categories', () => {
    const { netWorth, totalAssets, totalLiabilities } = calcNetWorth(makeFullSnapshot(), 'INR', 'overall');
    expect(totalAssets).toBe(5_500_000);
    expect(totalLiabilities).toBe(2_000_000);
    expect(netWorth).toBe(3_500_000);
  });

  it('liquid mode: includes only isLiquid categories', () => {
    const { netWorth, totalAssets } = calcNetWorth(makeFullSnapshot(), 'INR', 'liquid');
    expect(totalAssets).toBe(500_000);
    expect(netWorth).toBe(500_000);
  });

  it('investable mode: includes only isInvestable categories', () => {
    const { netWorth } = calcNetWorth(makeFullSnapshot(), 'INR', 'investable');
    expect(netWorth).toBe(500_000);
  });

  it('defaults to overall mode when viewMode omitted', () => {
    const snap = makeFullSnapshot();
    expect(calcNetWorth(snap, 'INR').netWorth).toBe(calcNetWorth(snap, 'INR', 'overall').netWorth);
  });

  it('returns zero for empty snapshot', () => {
    const { netWorth, totalAssets, totalLiabilities } = calcNetWorth(makeSnapshot(), 'INR');
    expect(netWorth).toBe(0);
    expect(totalAssets).toBe(0);
    expect(totalLiabilities).toBe(0);
  });

  it('categoryTotals keys match category IDs', () => {
    const snap = makeFullSnapshot();
    const { categoryTotals } = calcNetWorth(snap, 'INR', 'overall');
    expect(Object.keys(categoryTotals)).toContain('liquid-asset');
    expect(Object.keys(categoryTotals)).toContain('non-liquid-asset');
    expect(Object.keys(categoryTotals)).toContain('liability');
  });

  it('negative net worth when liabilities exceed assets', () => {
    const snap = makeSnapshot({
      categories: [
        makeCategory({
          id: 'a', type: 'asset',
          items: [{ id: 'i1', name: 'A', amount: 100_000, currency: 'INR' }],
        }),
        makeCategory({
          id: 'l', type: 'liability',
          items: [{ id: 'i2', name: 'L', amount: 500_000, currency: 'INR' }],
        }),
      ],
    });
    expect(calcNetWorth(snap, 'INR').netWorth).toBe(-400_000);
  });
});

// ---------------------------------------------------------------------------
// calcNetWorthForGoal
// ---------------------------------------------------------------------------

describe('calcNetWorthForGoal', () => {
  function makeGoalSnapshot(): Snapshot {
    return makeSnapshot({
      categories: [
        makeCategory({
          id: 'investments',
          name: 'Investments',
          type: 'asset',
          isLiquid: true,
          isInvestable: true,
          items: [{ id: 'i1', name: 'Stocks', amount: 3_000_000, currency: 'INR' }],
        }),
        makeCategory({
          id: 'real-estate',
          name: 'Real Estate',
          type: 'asset',
          isLiquid: false,
          isInvestable: false,
          items: [{ id: 'i2', name: 'House', amount: 5_000_000, currency: 'INR' }],
        }),
        makeCategory({
          id: 'home-loan',
          name: 'Home Loan',
          type: 'liability',
          isLiquid: false,
          isInvestable: false,
          items: [{ id: 'i3', name: 'Mortgage', amount: 2_000_000, currency: 'INR' }],
        }),
      ],
    });
  }

  it('no exclusions, overall mode: returns same as calcNetWorth overall', () => {
    const snap = makeGoalSnapshot();
    const result = calcNetWorthForGoal(snap, 'INR', [], 'overall');
    expect(result).toBe(6_000_000); // 8M assets - 2M liabilities
  });

  it('excludes specified category IDs', () => {
    const snap = makeGoalSnapshot();
    // Exclude real estate and home loan
    const result = calcNetWorthForGoal(snap, 'INR', ['real-estate', 'home-loan'], 'overall');
    expect(result).toBe(3_000_000); // only investments remain
  });

  it('excludes only the specified ID, not others', () => {
    const snap = makeGoalSnapshot();
    const result = calcNetWorthForGoal(snap, 'INR', ['real-estate'], 'overall');
    expect(result).toBe(1_000_000); // 3M investments - 2M home loan
  });

  it('investable mode + exclusions: filters to investable first, then excludes', () => {
    const snap = makeGoalSnapshot();
    // In investable mode, real-estate is already excluded (isInvestable=false)
    // So excluding 'investments' from investable view gives 0
    const result = calcNetWorthForGoal(snap, 'INR', ['investments'], 'investable');
    expect(result).toBe(0);
  });

  it('investable mode with no extra exclusions: only investable categories', () => {
    const snap = makeGoalSnapshot();
    const result = calcNetWorthForGoal(snap, 'INR', [], 'investable');
    expect(result).toBe(3_000_000); // only investments (investable=true)
  });

  it('returns 0 for empty snapshot', () => {
    expect(calcNetWorthForGoal(makeSnapshot(), 'INR', [])).toBe(0);
  });

  it('ignores non-existent excluded IDs gracefully', () => {
    const snap = makeGoalSnapshot();
    const result = calcNetWorthForGoal(snap, 'INR', ['does-not-exist'], 'overall');
    expect(result).toBe(6_000_000); // no change
  });

  it('handles negative net worth correctly after exclusions', () => {
    const snap = makeSnapshot({
      categories: [
        makeCategory({
          id: 'a1', type: 'asset',
          items: [{ id: 'i1', name: 'Asset', amount: 100_000, currency: 'INR' }],
        }),
        makeCategory({
          id: 'l1', type: 'liability',
          items: [{ id: 'i2', name: 'Debt', amount: 300_000, currency: 'INR' }],
        }),
      ],
    });
    // Excluding the only asset leaves just the liability → negative
    expect(calcNetWorthForGoal(snap, 'INR', ['a1'])).toBe(-300_000);
  });
});

// ---------------------------------------------------------------------------
// buildTrendData
// ---------------------------------------------------------------------------

describe('buildTrendData', () => {
  function makeSnapWithMonth(month: string, netWorth: number): Snapshot {
    return makeSnapshot({
      id: month,
      month,
      categories: [
        makeCategory({
          id: `asset-${month}`,
          type: 'asset',
          items: [{ id: `i-${month}`, name: 'A', amount: netWorth, currency: 'INR' }],
        }),
      ],
    });
  }

  it('returns up to 12 data points', () => {
    const snaps = Array.from({ length: 15 }, (_, i) =>
      makeSnapWithMonth(`2024-${String(i + 1).padStart(2, '0')}`, 100_000 * (i + 1))
    );
    expect(buildTrendData(snaps, 'INR').length).toBe(12);
  });

  it('sorts by month before returning (older first)', () => {
    const snaps = [
      makeSnapWithMonth('2025-03', 300_000),
      makeSnapWithMonth('2025-01', 100_000),
      makeSnapWithMonth('2025-02', 200_000),
    ];
    const trend = buildTrendData(snaps, 'INR');
    expect(trend[0].netWorth).toBe(100_000);
    expect(trend[1].netWorth).toBe(200_000);
    expect(trend[2].netWorth).toBe(300_000);
  });

  it('returns empty array for empty snapshots', () => {
    expect(buildTrendData([], 'INR')).toHaveLength(0);
  });

  it('month label is formatted correctly', () => {
    const snaps = [makeSnapWithMonth('2025-01', 100_000)];
    const trend = buildTrendData(snaps, 'INR');
    expect(trend[0].month).toMatch(/Jan/i);
  });
});

// ---------------------------------------------------------------------------
// buildAllocationData
// ---------------------------------------------------------------------------

describe('buildAllocationData', () => {
  it('returns items sorted by value descending', () => {
    const snap = makeSnapshot({
      categories: [
        makeCategory({ id: 'c1', name: 'Small', type: 'asset', items: [{ id: 'i1', name: 'X', amount: 100, currency: 'INR' }] }),
        makeCategory({ id: 'c2', name: 'Large', type: 'asset', items: [{ id: 'i2', name: 'Y', amount: 1000, currency: 'INR' }] }),
      ],
    });
    const items = buildAllocationData(snap, 'INR');
    expect(items[0].name).toBe('Large');
    expect(items[1].name).toBe('Small');
  });

  it('excludes zero-value categories', () => {
    const snap = makeSnapshot({
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [] }),
        makeCategory({ id: 'c2', type: 'asset', items: [{ id: 'i1', name: 'X', amount: 500, currency: 'INR' }] }),
      ],
    });
    const items = buildAllocationData(snap, 'INR');
    expect(items).toHaveLength(1);
  });

  it('calculates percentage relative to total assets for assets', () => {
    const snap = makeSnapshot({
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [{ id: 'i1', name: 'X', amount: 300, currency: 'INR' }] }),
        makeCategory({ id: 'c2', type: 'asset', items: [{ id: 'i2', name: 'Y', amount: 700, currency: 'INR' }] }),
      ],
    });
    const items = buildAllocationData(snap, 'INR');
    const c2 = items.find(i => i.name === 'Test Category' && i.value === 700);
    expect(c2?.percentage).toBeCloseTo(70);
  });

  it('returns empty array for empty snapshot', () => {
    expect(buildAllocationData(makeSnapshot(), 'INR')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// calcMonthChange
// ---------------------------------------------------------------------------

describe('calcMonthChange', () => {
  const baseSnap = makeSnapshot({
    categories: [
      makeCategory({ id: 'a', type: 'asset', items: [{ id: 'i1', name: 'X', amount: 1_100_000, currency: 'INR' }] }),
    ],
  });
  const prevSnap = makeSnapshot({
    id: 's0',
    categories: [
      makeCategory({ id: 'a', type: 'asset', items: [{ id: 'i1', name: 'X', amount: 1_000_000, currency: 'INR' }] }),
    ],
  });

  it('returns 0 change when no previous snapshot', () => {
    const { change, changePercent } = calcMonthChange(baseSnap, undefined, 'INR');
    expect(change).toBe(0);
    expect(changePercent).toBe(0);
  });

  it('calculates positive change correctly', () => {
    const { change, changePercent } = calcMonthChange(baseSnap, prevSnap, 'INR');
    expect(change).toBe(100_000);
    expect(changePercent).toBeCloseTo(10);
  });

  it('calculates negative change correctly', () => {
    const { change, changePercent } = calcMonthChange(prevSnap, baseSnap, 'INR');
    expect(change).toBe(-100_000);
    expect(changePercent).toBeCloseTo(-9.09, 1);
  });

  it('handles zero previous net worth without divide-by-zero', () => {
    const emptySnap = makeSnapshot();
    const { changePercent } = calcMonthChange(baseSnap, emptySnap, 'INR');
    expect(changePercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// cloneLatestSnapshot month math (unchanged tests, consolidated here)
// ---------------------------------------------------------------------------

describe('cloneLatestSnapshot month math', () => {
  function nextMonth(month: string): string {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const next = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? year + 1 : year;
    return `${nextYear}-${String(next).padStart(2, '0')}`;
  }

  it('increments month within year', () => {
    expect(nextMonth('2025-01')).toBe('2025-02');
    expect(nextMonth('2025-06')).toBe('2025-07');
    expect(nextMonth('2025-11')).toBe('2025-12');
  });

  it('rolls over December to January next year', () => {
    expect(nextMonth('2025-12')).toBe('2026-01');
    expect(nextMonth('2024-12')).toBe('2025-01');
  });

  it('handles single-digit months with padding', () => {
    expect(nextMonth('2025-03')).toBe('2025-04');
  });
});

// ---------------------------------------------------------------------------
// getMissingRateCurrencies
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<LineItem> & { id: string; name: string; amount: number; currency: string }): LineItem {
  return {
    excludeFromNetWorth: false,
    excludeFromGoals: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calcSavingsRate
// ---------------------------------------------------------------------------

describe('calcSavingsRate', () => {
  it('returns correct savings rate', () => {
    expect(calcSavingsRate(100_000, 60_000)).toBeCloseTo(40);
  });

  it('returns 100 when expenses are zero', () => {
    expect(calcSavingsRate(100_000, 0)).toBeCloseTo(100);
  });

  it('returns negative rate when expenses exceed income', () => {
    expect(calcSavingsRate(50_000, 75_000)).toBeCloseTo(-50);
  });

  it('returns 0 when income is zero', () => {
    expect(calcSavingsRate(0, 5_000)).toBe(0);
  });

  it('returns 0 when income is negative', () => {
    expect(calcSavingsRate(-1_000, 500)).toBe(0);
  });

  it('returns 0 when both income and expenses are zero', () => {
    expect(calcSavingsRate(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getMissingRateCurrencies
// ---------------------------------------------------------------------------

describe('getMissingRateCurrencies', () => {
  it('returns empty array when all currencies have valid rates', () => {
    // USD is the anchor — never flagged as missing regardless of exchangeRates
    const snap = makeSnapshot({
      exchangeRates: { INR: 83 },
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'USD' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'INR')).toEqual([]);
  });

  it('returns empty array for items already in base currency', () => {
    const snap = makeSnapshot({
      exchangeRates: {},
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'INR' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'INR')).toEqual([]);
  });

  it('flags currencies with no exchange rate', () => {
    const snap = makeSnapshot({
      exchangeRates: {},
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'EUR' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'INR')).toEqual(['EUR']);
  });

  it('flags currencies with a zero rate', () => {
    const snap = makeSnapshot({
      exchangeRates: { EUR: 0 },
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'EUR' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'INR')).toEqual(['EUR']);
  });

  it('ignores items excluded from net worth', () => {
    const snap = makeSnapshot({
      exchangeRates: {},
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'EUR', excludeFromNetWorth: true })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'INR')).toEqual([]);
  });

  it('deduplicates repeated missing currencies across categories', () => {
    const snap = makeSnapshot({
      exchangeRates: {},
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'EUR' })] }),
        makeCategory({ id: 'c2', type: 'asset', items: [makeItem({ id: 'i2', name: 'B', amount: 200, currency: 'EUR' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'INR')).toEqual(['EUR']);
  });
});

// ---------------------------------------------------------------------------
// anchorRate (exported helper)
// ---------------------------------------------------------------------------

describe('anchorRate', () => {
  it('returns 1 for the anchor currency regardless of rates map', () => {
    expect(anchorRate(RATE_ANCHOR, {})).toBe(1);
    expect(anchorRate(RATE_ANCHOR, { USD: 99 })).toBe(1); // USD key is irrelevant
  });

  it('returns the stored rate for non-anchor currencies', () => {
    expect(anchorRate('INR', { INR: 83 })).toBe(83);
    expect(anchorRate('SGD', { SGD: 1.34 })).toBe(1.34);
  });

  it('returns 0 when rate is missing', () => {
    expect(anchorRate('EUR', {})).toBe(0);
  });

  it('returns 0 when rate is zero', () => {
    expect(anchorRate('EUR', { EUR: 0 })).toBe(0);
  });

  it('returns 0 when rate is negative', () => {
    expect(anchorRate('EUR', { EUR: -1 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// convertToBase — anchor-relative cross-currency paths
// ---------------------------------------------------------------------------

describe('convertToBase — anchor-relative cross-currency', () => {
  it('converts SGD → INR via anchor (the primary new formula path)', () => {
    // rates: "1 USD = 83 INR, 1 USD = 1.34 SGD"
    // expected: 1000 SGD * (83 INR/USD) / (1.34 SGD/USD) ≈ 61,940 INR
    const rates = { INR: 83, SGD: 1.34 };
    expect(convertToBase(1000, 'SGD', 'INR', rates)).toBeCloseTo(61940.3, 0);
  });

  it('converts INR → USD using anchor (toRate = 1)', () => {
    // rates: "1 USD = 83 INR"
    // expected: 1000 INR * 1 / 83 ≈ 12.05 USD
    expect(convertToBase(1000, 'INR', 'USD', { INR: 83 })).toBeCloseTo(12.05, 1);
  });

  it('converts USD → INR using anchor (fromRate = 1)', () => {
    // Verified in existing test; included here for explicit anchor semantics
    expect(convertToBase(100, 'USD', 'INR', { INR: 83 })).toBe(8300);
  });

  it('converts EUR → SGD cross-rate', () => {
    // rates: "1 USD = 0.92 EUR, 1 USD = 1.34 SGD"
    // 100 EUR * (1.34 SGD/USD) / (0.92 EUR/USD) ≈ 145.65 SGD
    const rates = { EUR: 0.92, SGD: 1.34 };
    expect(convertToBase(100, 'EUR', 'SGD', rates)).toBeCloseTo(145.65, 1);
  });

  it('round-trips correctly: convert to base then back', () => {
    const rates = { INR: 83, SGD: 1.34 };
    const inr = convertToBase(1000, 'SGD', 'INR', rates);
    const sgdBack = convertToBase(inr, 'INR', 'SGD', rates);
    expect(sgdBack).toBeCloseTo(1000, 3);
  });
});

// ---------------------------------------------------------------------------
// getMissingRateCurrencies — anchor / USD-as-base edge cases
// ---------------------------------------------------------------------------

describe('getMissingRateCurrencies — anchor edge cases', () => {
  it('USD item is never flagged as missing (USD is the implicit anchor)', () => {
    const snap = makeSnapshot({
      exchangeRates: { INR: 83 }, // no USD key — correct anchor-relative format
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'USD' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'INR')).toEqual([]);
  });

  it('USD item is not flagged even with empty rates when base is USD', () => {
    const snap = makeSnapshot({
      exchangeRates: {},
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'USD' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'USD')).toEqual([]);
  });

  it('flags non-anchor foreign currency missing rate when base is USD', () => {
    const snap = makeSnapshot({
      exchangeRates: {}, // SGD rate not set
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'SGD' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'USD')).toEqual(['SGD']);
  });

  it('does not flag non-anchor currency that has a valid rate', () => {
    const snap = makeSnapshot({
      exchangeRates: { SGD: 1.34 },
      categories: [
        makeCategory({ id: 'c1', type: 'asset', items: [makeItem({ id: 'i1', name: 'A', amount: 100, currency: 'SGD' })] }),
      ],
    });
    expect(getMissingRateCurrencies(snap, 'USD')).toEqual([]);
  });
});
