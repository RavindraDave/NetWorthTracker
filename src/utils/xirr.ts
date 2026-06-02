export interface CashFlow {
  amount: number;
  date: Date;
}

function yearFraction(t0: Date, t1: Date): number {
  return (t1.getTime() - t0.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function npv(rate: number, flows: CashFlow[], t0: Date): number {
  return flows.reduce((sum, { amount, date }) => {
    const t = yearFraction(t0, date);
    return sum + amount / Math.pow(1 + rate, t);
  }, 0);
}

function npvDerivative(rate: number, flows: CashFlow[], t0: Date): number {
  return flows.reduce((sum, { amount, date }) => {
    const t = yearFraction(t0, date);
    if (t === 0) return sum;
    return sum - t * amount / Math.pow(1 + rate, t + 1);
  }, 0);
}

/**
 * Compute XIRR (annualised internal rate of return for irregular cash flows).
 * Cash flows must include at least one negative (outflow) and one positive (inflow).
 * Returns null if the series doesn't converge or inputs are invalid.
 */
export function calculateXIRR(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;
  if (!flows.some(f => f.amount < 0)) return null;
  if (!flows.some(f => f.amount > 0)) return null;

  const t0 = flows.reduce((min, f) => f.date < min ? f.date : min, flows[0].date);

  let rate = 0.1; // initial guess: 10%
  for (let i = 0; i < 200; i++) {
    const f  = npv(rate, flows, t0);
    const df = npvDerivative(rate, flows, t0);
    if (Math.abs(df) < 1e-14) break;
    const next = rate - f / df;
    if (Math.abs(next - rate) < 1e-8) {
      return Math.abs(npv(next, flows, t0)) < 0.1 ? next : null;
    }
    rate = Math.max(-0.9999, Math.min(1000, next));
  }
  return null;
}
