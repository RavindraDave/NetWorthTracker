import { Goal, Snapshot } from '../types';
import { calcNetWorth } from './calculations';

export interface FIREMetrics {
  fiNumber: number;
  currentNetWorth: number;
  progressPercentage: number;
  savingsRatePercentage: number;
  monthlySavings: number;
  yearsToFI: number | null; // null if not saving or saving is negative
  safeWithdrawalRate: number; // the percentage (e.g., 4)
  monthlyPassiveIncome: number; // current NW * SWR / 12
  isFI: boolean;
}

export function calcFIREMetrics(
  goal: Goal,
  currentSnapshot: Snapshot | null,
  baseCurrency: string
): FIREMetrics {
  const annualExpenses = goal.annualExpenses ?? 0;
  // If multiplier is not provided, derive it from withdrawal rate (e.g., 4% = 25x)
  const multiplier = goal.multiplier ?? (goal.withdrawalRate ? 100 / goal.withdrawalRate : 25);
  const safeWithdrawalRate = goal.withdrawalRate ?? (100 / multiplier);

  const fiNumber = annualExpenses * multiplier;
  
  const currentNetWorth = currentSnapshot ? calcNetWorth(currentSnapshot, baseCurrency, 'investable').netWorth : 0;
  
  // Progress is bounded between 0 and 100
  const rawProgress = fiNumber > 0 ? (currentNetWorth / fiNumber) * 100 : 0;
  const progressPercentage = Math.min(Math.max(rawProgress, 0), 100);

  // Cash Flow / Savings Rate
  const income = currentSnapshot?.monthlyIncome ?? 0;
  const expenses = currentSnapshot?.monthlyExpenses ?? 0;
  const monthlySavings = income - expenses;
  
  const savingsRatePercentage = income > 0 ? (monthlySavings / income) * 100 : 0;

  // Years to FI (simple linear projection, ignoring compound interest for simplicity in v1, or basic FV)
  // For v1, we use a basic compound interest formula if we assume an average market return of say 5% real.
  // FV = PV * (1+r)^n + PMT * [((1+r)^n - 1) / r]
  // Solving for n is complex. We will use a simpler approximation:
  // If they need to save (fiNumber - currentNetWorth) and save monthlySavings per month...
  // Let's assume a 5% real annual return (0.05 / 12 per month).
  let yearsToFI: number | null = null;
  
  if (currentNetWorth >= fiNumber) {
    yearsToFI = 0;
  } else if (monthlySavings > 0) {
    const r = 0.05 / 12; // 5% real return monthly
    const pmt = monthlySavings;
    const pv = currentNetWorth;
    const fv = fiNumber;

    // NPER formula in Excel: NPER(rate, pmt, pv, fv)
    // n = log((PMT - FV*r) / (PMT + PV*r)) / log(1+r) if solving for standard signs,
    // Actually, n = log((pmt + fv * r) / (pmt + pv * r)) / log(1 + r)
    const numerator = pmt + fv * r;
    const denominator = pmt + pv * r;
    
    if (denominator > 0 && numerator > 0) {
      const months = Math.log(numerator / denominator) / Math.log(1 + r);
      yearsToFI = Math.max(months / 12, 0);
    }
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
    isFI: currentNetWorth >= fiNumber && fiNumber > 0
  };
}
