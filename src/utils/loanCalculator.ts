/**
 * Standard reducing-balance amortisation.
 *
 * Returns the outstanding principal owed at the start of `currentMonth`
 * (i.e. after all EMIs paid up to but not including that month).
 *
 * Formula for remaining balance after k payments:
 *   outstanding = EMI × (1 − (1+r)^−(n−k)) / r
 *
 * where r = annualRate / 12 / 100, n = tenureMonths, k = months elapsed.
 *
 * Edge cases:
 *   k <= 0  → loan hasn't started yet; return principal in full
 *   k >= n  → loan is fully paid;      return 0
 *   r == 0  → interest-free; balance declines linearly
 */
export function calculateOutstandingBalance(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  loanStartMonth: string,  // "YYYY-MM"
  currentMonth: string,    // "YYYY-MM"
): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;

  const [sy, sm] = loanStartMonth.split('-').map(Number);
  const [cy, cm] = currentMonth.split('-').map(Number);
  const elapsed = (cy - sy) * 12 + (cm - sm);

  if (elapsed <= 0) return principal;
  if (elapsed >= tenureMonths) return 0;

  const remaining = tenureMonths - elapsed;
  // Cap rate at 100% p.a. to prevent Math.pow overflow with runaway inputs
  const r = Math.min(annualRate, 100) / 12 / 100;

  if (r === 0) {
    return principal * (remaining / tenureMonths);
  }

  const emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
  return (emi * (1 - Math.pow(1 + r, -remaining))) / r;
}

/** Returns true only when all four required loan parameters are provided and valid. */
export function isLoanConfigComplete(
  principal: number | undefined,
  annualRate: number | undefined,
  tenure: number | undefined,
  startMonth: string | undefined,
): boolean {
  return (
    typeof principal === 'number' && principal > 0 &&
    typeof annualRate === 'number' && annualRate >= 0 &&
    typeof tenure === 'number' && tenure > 0 &&
    typeof startMonth === 'string' && /^\d{4}-\d{2}$/.test(startMonth)
  );
}
