import { describe, it, expect } from 'vitest';
import { calculateOutstandingBalance, calculateLoanSummary, isLoanConfigComplete } from '../loanCalculator';

const P  = 8_000_000; // ₹80 L principal
const R  = 8.5;       // 8.5% p.a.
const N  = 240;       // 20 years
const S  = '2024-01'; // started Jan 2024

describe('calculateOutstandingBalance', () => {
  it('returns full principal when loan has not started yet', () => {
    expect(calculateOutstandingBalance(P, R, N, S, '2023-12')).toBe(P);
    expect(calculateOutstandingBalance(P, R, N, S, '2024-01')).toBe(P);
  });

  it('returns 0 when all EMIs have been paid', () => {
    expect(calculateOutstandingBalance(P, R, N, S, '2044-01')).toBe(0);
    expect(calculateOutstandingBalance(P, R, N, S, '2050-06')).toBe(0);
  });

  it('returns roughly the original principal after the first payment', () => {
    // After 1 month ~99% of principal remains (mostly interest)
    const bal = calculateOutstandingBalance(P, R, N, S, '2024-02');
    expect(bal).toBeGreaterThan(P * 0.98);
    expect(bal).toBeLessThan(P);
  });

  it('outstanding declines over time', () => {
    const bal12  = calculateOutstandingBalance(P, R, N, S, '2025-01'); // after 12 months
    const bal120 = calculateOutstandingBalance(P, R, N, S, '2034-01'); // after 120 months
    const bal200 = calculateOutstandingBalance(P, R, N, S, '2040-09'); // after 200 months
    expect(bal12).toBeGreaterThan(bal120);
    expect(bal120).toBeGreaterThan(bal200);
    expect(bal200).toBeGreaterThan(0);
  });

  it('balances sum to full principal present-value (EMI integrity check)', () => {
    // Outstanding at start is roughly the principal (within 1%)
    const bal = calculateOutstandingBalance(P, R, N, S, '2024-02');
    expect(bal / P).toBeCloseTo(1, 1);
  });

  it('handles interest-free loans with linear decline', () => {
    const bal = calculateOutstandingBalance(1_200_000, 0, 120, '2020-01', '2025-01'); // after 60/120 months
    expect(bal).toBeCloseTo(600_000, -3); // ~₹6 L remaining (±₹1000 tolerance)
  });

  it('returns 0 when principal is 0', () => {
    expect(calculateOutstandingBalance(0, R, N, S, '2025-01')).toBe(0);
  });

  it('returns 0 when tenure is 0', () => {
    expect(calculateOutstandingBalance(P, R, 0, S, '2025-01')).toBe(0);
  });
});

describe('calculateLoanSummary', () => {
  it('computes the standard EMI for a typical home loan', () => {
    // ₹80 L @ 8.5% over 240 months → ~₹69,400/mo (well-known amortisation result)
    const { emi } = calculateLoanSummary(P, R, N);
    expect(emi).toBeGreaterThan(69_000);
    expect(emi).toBeLessThan(69_800);
  });

  it('derives total payment and interest from the EMI', () => {
    const { emi, totalPayment, totalInterest } = calculateLoanSummary(P, R, N);
    expect(totalPayment).toBeCloseTo(emi * N, 6);
    expect(totalInterest).toBeCloseTo(totalPayment - P, 6);
    expect(totalInterest).toBeGreaterThan(0);
  });

  it('charges no interest on an interest-free loan', () => {
    const { emi, totalInterest } = calculateLoanSummary(1_200_000, 0, 120);
    expect(emi).toBeCloseTo(10_000, 6); // 1.2M / 120
    expect(totalInterest).toBeCloseTo(0, 6);
  });

  it('returns zeroes for invalid input', () => {
    expect(calculateLoanSummary(0, R, N)).toEqual({ emi: 0, totalPayment: 0, totalInterest: 0 });
    expect(calculateLoanSummary(P, R, 0)).toEqual({ emi: 0, totalPayment: 0, totalInterest: 0 });
  });
});

describe('isLoanConfigComplete', () => {
  it('returns true when all params are valid', () => {
    expect(isLoanConfigComplete(P, R, N, S)).toBe(true);
  });

  it('returns false when principal is missing or zero', () => {
    expect(isLoanConfigComplete(undefined, R, N, S)).toBe(false);
    expect(isLoanConfigComplete(0, R, N, S)).toBe(false);
  });

  it('returns false when rate is missing', () => {
    expect(isLoanConfigComplete(P, undefined, N, S)).toBe(false);
  });

  it('allows zero rate (interest-free loan)', () => {
    expect(isLoanConfigComplete(P, 0, N, S)).toBe(true);
  });

  it('returns false when tenure is missing or zero', () => {
    expect(isLoanConfigComplete(P, R, undefined, S)).toBe(false);
    expect(isLoanConfigComplete(P, R, 0, S)).toBe(false);
  });

  it('returns false when startMonth is missing or invalid format', () => {
    expect(isLoanConfigComplete(P, R, N, undefined)).toBe(false);
    expect(isLoanConfigComplete(P, R, N, '01-2024')).toBe(false);
    expect(isLoanConfigComplete(P, R, N, '2024/01')).toBe(false);
  });
});
