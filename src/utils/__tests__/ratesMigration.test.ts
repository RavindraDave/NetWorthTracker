import { describe, it, expect } from 'vitest';
import { migrateToAnchorRates } from '../ratesMigration';
import type { Snapshot } from '../../types';

const RATE_ANCHOR = 'USD';

function makeSnap(exchangeRates: Record<string, number>, ratesAnchor?: string): Snapshot {
  return {
    id: 's1',
    month: '2025-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exchangeRates,
    ratesAnchor,
    categories: [],
  };
}

describe('migrateToAnchorRates', () => {
  // ── Already migrated ────────────────────────────────────────────────────────

  it('returns snap unchanged when ratesAnchor is already USD', () => {
    const snap = makeSnap({ INR: 83, SGD: 1.34 }, RATE_ANCHOR);
    const result = migrateToAnchorRates(snap, 'INR');
    expect(result).toBe(snap); // same reference — no copy made
  });

  // ── Normal migration (non-USD base) ─────────────────────────────────────────

  it('migrates INR-base rates correctly', () => {
    // old: { USD: 83, SGD: 62 } — "1 USD = 83 INR, 1 SGD = 62 INR"
    const snap = makeSnap({ USD: 83, SGD: 62, EUR: 90 });
    const result = migrateToAnchorRates(snap, 'INR');

    expect(result.ratesAnchor).toBe(RATE_ANCHOR);
    expect(result.exchangeRates.INR).toBe(83);            // usdToBase = 83
    expect(result.exchangeRates.SGD).toBeCloseTo(83 / 62, 5); // ≈ 1.33871
    expect(result.exchangeRates.EUR).toBeCloseTo(83 / 90, 5); // ≈ 0.92222
    expect(result.exchangeRates.USD).toBeUndefined();    // anchor never stored
  });

  it('sets ratesAnchor to USD on migrated snapshot', () => {
    const snap = makeSnap({ USD: 83 });
    const result = migrateToAnchorRates(snap, 'INR');
    expect(result.ratesAnchor).toBe('USD');
  });

  it('handles only the USD key (no other currencies)', () => {
    const snap = makeSnap({ USD: 83 });
    const result = migrateToAnchorRates(snap, 'INR');
    expect(result.exchangeRates).toEqual({ INR: 83 });
  });

  it('skips currencies with zero or negative old rates', () => {
    const snap = makeSnap({ USD: 83, SGD: 0, EUR: -5, GBP: 110 });
    const result = migrateToAnchorRates(snap, 'INR');
    expect(result.exchangeRates.SGD).toBeUndefined();
    expect(result.exchangeRates.EUR).toBeUndefined();
    expect(result.exchangeRates.GBP).toBeCloseTo(83 / 110, 5);
  });

  // ── USD-as-base migration ────────────────────────────────────────────────────

  it('migrates USD-base rates by inverting them', () => {
    // old: { EUR: 0.92, SGD: 0.75 } — "1 EUR = 0.92 USD, 1 SGD = 0.75 USD" (base=USD)
    const snap = makeSnap({ EUR: 0.92, SGD: 0.75, INR: 0.01205 });
    const result = migrateToAnchorRates(snap, RATE_ANCHOR);

    expect(result.ratesAnchor).toBe(RATE_ANCHOR);
    expect(result.exchangeRates.EUR).toBeCloseTo(1 / 0.92, 5);   // ≈ 1.08696
    expect(result.exchangeRates.SGD).toBeCloseTo(1 / 0.75, 5);   // ≈ 1.33333
    expect(result.exchangeRates.INR).toBeCloseTo(1 / 0.01205, 3); // ≈ 83.0
  });

  it('USD-base: skips currencies with zero or negative rates', () => {
    const snap = makeSnap({ EUR: 0.92, SGD: 0 });
    const result = migrateToAnchorRates(snap, RATE_ANCHOR);
    expect(result.exchangeRates.EUR).toBeCloseTo(1 / 0.92, 5);
    expect(result.exchangeRates.SGD).toBeUndefined();
  });

  it('USD-base with empty rates returns empty rates (nothing to invert)', () => {
    const snap = makeSnap({});
    const result = migrateToAnchorRates(snap, RATE_ANCHOR);
    expect(result.exchangeRates).toEqual({});
    expect(result.ratesAnchor).toBe(RATE_ANCHOR);
  });

  // ── Unknown / missing USD reference ─────────────────────────────────────────

  it('clears rates when USD is missing and base is not USD', () => {
    // Non-USD base but no USD key → can't derive anchor rates
    const snap = makeSnap({ SGD: 62, EUR: 90 }); // no USD key, base=INR
    const result = migrateToAnchorRates(snap, 'INR');
    expect(result.exchangeRates).toEqual({});
    expect(result.ratesAnchor).toBe(RATE_ANCHOR);
  });

  it('clears rates when USD rate is zero', () => {
    const snap = makeSnap({ USD: 0, SGD: 62 });
    const result = migrateToAnchorRates(snap, 'INR');
    expect(result.exchangeRates).toEqual({});
    expect(result.ratesAnchor).toBe(RATE_ANCHOR);
  });

  it('clears rates when USD rate is negative', () => {
    const snap = makeSnap({ USD: -83, SGD: 62 });
    const result = migrateToAnchorRates(snap, 'INR');
    expect(result.exchangeRates).toEqual({});
    expect(result.ratesAnchor).toBe(RATE_ANCHOR);
  });

  // ── Idempotency ──────────────────────────────────────────────────────────────

  it('is idempotent — running twice produces same result', () => {
    const snap = makeSnap({ USD: 83, SGD: 62 });
    const once = migrateToAnchorRates(snap, 'INR');
    const twice = migrateToAnchorRates(once, 'INR');
    expect(twice).toBe(once); // second call returns same reference (early exit)
  });

  // ── Does not mutate original ─────────────────────────────────────────────────

  it('does not mutate the input snapshot', () => {
    const snap = makeSnap({ USD: 83, SGD: 62 });
    const original = JSON.stringify(snap);
    migrateToAnchorRates(snap, 'INR');
    expect(JSON.stringify(snap)).toBe(original);
  });
});
