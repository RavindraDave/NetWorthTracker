import { describe, it, expect } from 'vitest';
import { calculateXIRR } from '../xirr';

const DAY = 24 * 60 * 60 * 1000;

describe('calculateXIRR', () => {
  it('returns null without both an inflow and an outflow', () => {
    expect(calculateXIRR([{ amount: -100, date: new Date('2025-01-01') }])).toBeNull();
    expect(calculateXIRR([
      { amount: -100, date: new Date('2025-01-01') },
      { amount: -50, date: new Date('2025-06-01') },
    ])).toBeNull();
  });

  it('computes ~10% for a 10% gain held exactly one year', () => {
    const r = calculateXIRR([
      { amount: -100, date: new Date('2025-01-01') },
      { amount: 110, date: new Date('2026-01-01') },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.095);
    expect(r!).toBeLessThan(0.105);
  });

  it('handles large-magnitude portfolios (relative tolerance)', () => {
    // ₹3.5cr → ₹5.1cr over ~2 years — an absolute NPV tolerance of 0.1 would wrongly reject this
    const r = calculateXIRR([
      { amount: -35_000_000, date: new Date('2024-06-01') },
      { amount: 51_000_000, date: new Date(new Date('2024-06-01').getTime() + 730 * DAY) },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.15);
    expect(r!).toBeLessThan(0.25);
  });

  it('returns a negative rate for a loss', () => {
    const r = calculateXIRR([
      { amount: -100, date: new Date('2025-01-01') },
      { amount: 80, date: new Date('2026-01-01') },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(0);
  });
});
