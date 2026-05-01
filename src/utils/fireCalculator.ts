import { Goal, Snapshot } from '../types';
import { calcNetWorth } from './calculations';

export interface FIREMetrics {
  fiNumber: number;
  currentNetWorth: number;
  progressPercentage: number;
  savingsRatePercentage: number;
  monthlySavings: number;
  yearsToFI: number | null; // null if not saving or saving is negative
  safeWithdrawalRate: number;
  monthlyPassiveIncome: number;
  isFI: boolean;
  realReturnRate: number; // effective real annual rate used for projection
}

/**
 * Solve for months to reach fv starting at pv, saving pmt/month,
 * with monthly rate r and optional annual savings growth rate g (as a fraction, e.g. 0.05 = 5%).
 *
 * With g=0: closed-form NPER formula.
 * With g>0: iterative simulation (binary search) since no closed form exists.
 */
function calcMonthsToFI(pv: number, pmt: number, fv: number, r: number, annualGrowth: number): number | null {
  if (pmt <= 0) return null;

  if (annualGrowth === 0) {
    // NPER closed-form: n = log((pmt + fv*r) / (pmt + pv*r)) / log(1+r)
    const numerator   = pmt + fv * r;
    const denominator = pmt + pv * r;
    if (denominator <= 0 || numerator <= 0) return null;
    return Math.log(numerator / denominator) / Math.log(1 + r);
  }

  // Stepped savings: simulate month by month (cap at 600 months = 50 years)
  const monthlyGrowthFactor = Math.pow(1 + annualGrowth, 1 / 12);
  let balance = pv;
  let monthlySavings = pmt;
  for (let m = 1; m <= 600; m++) {
    balance = balance * (1 + r) + monthlySavings;
    monthlySavings *= monthlyGrowthFactor;
    if (balance >= fv) return m;
  }
  return null; // didn't converge
}

export function calcFIREMetrics(
  goal: Goal,
  currentSnapshot: Snapshot | null,
  baseCurrency: string
): FIREMetrics {
  const annualExpenses = goal.annualExpenses ?? 0;
  const multiplier = goal.multiplier ?? (goal.withdrawalRate ? 100 / goal.withdrawalRate : 25);
  const safeWithdrawalRate = goal.withdrawalRate ?? (100 / multiplier);

  // Phase 3.4: user-configurable return & inflation (real return = (1+nominal)/(1+inflation) - 1)
  const nominalReturn = (goal.expectedReturn ?? 7) / 100;
  const inflation     = (goal.inflationRate  ?? 3) / 100;
  const realAnnualReturn = (1 + nominalReturn) / (1 + inflation) - 1;
  const monthlyRate   = realAnnualReturn / 12;

  const annualSavingsGrowth = (goal.annualSavingsGrowth ?? 0) / 100;

  const fiNumber = annualExpenses * multiplier;

  const currentNetWorth = currentSnapshot
    ? calcNetWorth(currentSnapshot, baseCurrency, 'investable').netWorth
    : 0;

  const rawProgress = fiNumber > 0 ? (currentNetWorth / fiNumber) * 100 : 0;
  const progressPercentage = Math.min(Math.max(rawProgress, 0), 100);

  const income = currentSnapshot?.monthlyIncome ?? 0;
  const expenses = currentSnapshot?.monthlyExpenses ?? 0;
  const monthlySavings = income - expenses;
  const savingsRatePercentage = income > 0 ? (monthlySavings / income) * 100 : 0;

  let yearsToFI: number | null = null;

  if (currentNetWorth >= fiNumber && fiNumber > 0) {
    yearsToFI = 0;
  } else if (monthlySavings > 0) {
    const months = calcMonthsToFI(
      currentNetWorth,
      monthlySavings,
      fiNumber,
      monthlyRate,
      annualSavingsGrowth
    );
    if (months !== null) yearsToFI = Math.max(months / 12, 0);
  }

  const monthlyPassiveIncome = (currentNetWorth * (safeWithdrawalRate / 100)) / 12;

  return {
    fiNumber,
    currentNetWorth,
    progressPercentage,
    savingsRatePercentage,
    monthlySavings,
    yearsToFI,
    safeWithdrawalRate,
    monthlyPassiveIncome,
    isFI: currentNetWorth >= fiNumber && fiNumber > 0,
    realReturnRate: realAnnualReturn * 100,
  };
}
