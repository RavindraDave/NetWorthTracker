import { TaxParams } from '../types';

// India-specific defaults (Budget 2024, effective FY 2025-26)
export const DEFAULT_TAX_PARAMS: TaxParams = {
  ltcgRate: 12.5,
  stcgRate: 20,
  ltcgExemption: 125_000, // ₹1.25 lakh annual LTCG exemption
  equityPct: 80,
  ltcgPct: 70,
  debtRate: 30,
  cess: 4,
};

/**
 * Seed values for the jurisdiction picker in `GoalEditor`. `TaxParams`'s
 * 7-field shape (LTCG/STCG split + a flat exemption + a cess) is India's
 * model, not a generic one — it cannot represent US tax brackets or state
 * tax. `us_approx` is a labelled approximation only (see `TAX_PRESET_LABELS`),
 * not a real US withdrawal-tax model; ship it anyway rather than omitting a
 * US option entirely, since the alternative just pushes US users toward
 * hand-guessed, unlabelled numbers with no honesty caveat at all.
 */
export type TaxJurisdiction = 'india' | 'us_approx' | 'custom';

export const TAX_PRESETS: Record<Exclude<TaxJurisdiction, 'custom'>, TaxParams> = {
  india: DEFAULT_TAX_PARAMS,
  us_approx: {
    ltcgRate: 15,      // federal long-term capital gains, middle bracket
    stcgRate: 24,      // short-term gains taxed as ordinary income, approximated flat
    ltcgExemption: 0,  // no equivalent to India's ₹1.25L LTCG exemption
    equityPct: 80,
    ltcgPct: 70,
    debtRate: 24,
    cess: 0,           // no health/education cess in the US system
  },
};

export const TAX_PRESET_LABELS: Record<TaxJurisdiction, string> = {
  india: 'India (Budget 2024 — LTCG/STCG)',
  us_approx: 'US — approximate (long/short-term gains, no state tax, no cess)',
  custom: 'Custom',
};

/**
 * Which preset (if any) a stored `TaxParams` matches exactly — used only to
 * seed the jurisdiction dropdown when opening an existing goal, so it doesn't
 * misleadingly show "India" for a goal actually configured with the US preset
 * (or hand-edited values). `TaxParams` is never restructured to remember its
 * own origin — this just re-derives it from the numbers.
 */
export function matchTaxJurisdiction(params: TaxParams): TaxJurisdiction {
  const entry = (Object.entries(TAX_PRESETS) as [Exclude<TaxJurisdiction, 'custom'>, TaxParams][])
    .find(([, preset]) => Object.keys(preset).every(k => preset[k as keyof TaxParams] === params[k as keyof TaxParams]));
  return entry ? entry[0] : 'custom';
}

export interface TaxBreakdown {
  annualGross: number;
  equityLtcgGains: number;
  equityStcgGains: number;
  debtGains: number;
  ltcgTaxable: number;  // after annual exemption
  ltcgTax: number;
  stcgTax: number;
  debtTax: number;
  baseTax: number;
  cessAmount: number;
  totalTax: number;
  annualNet: number;
  monthlyNet: number;
  effectiveTaxRate: number; // %
}

/**
 * Calculate tax on an annual portfolio withdrawal.
 *
 * Conservative assumption: the full withdrawal amount is treated as capital gains
 * (i.e. no return-of-principal component). This overestimates tax slightly but is
 * the correct model for a large, long-compounding FIRE corpus where the basis is
 * a small fraction of current value.
 *
 * Tax rules applied (India, Budget 2024):
 *   - Equity LTCG (>12 months): taxed at ltcgRate% above the annual ltcgExemption
 *   - Equity STCG (≤12 months): taxed at stcgRate% (no exemption)
 *   - Debt / other:             taxed at debtRate% (at slab, Finance Act 2023)
 *   - Cess:                     cess% on base tax (health + education cess)
 */
export function calcWithdrawalTax(
  annualGross: number,
  params: TaxParams,
): TaxBreakdown {
  const equityGains = annualGross * (params.equityPct / 100);
  const debtGains   = annualGross - equityGains;

  const ltcgGains = equityGains * (params.ltcgPct / 100);
  const stcgGains = equityGains - ltcgGains;

  const ltcgTaxable = Math.max(0, ltcgGains - params.ltcgExemption);
  const ltcgTax     = ltcgTaxable * (params.ltcgRate / 100);
  const stcgTax     = stcgGains * (params.stcgRate / 100);
  const debtTax     = debtGains * (params.debtRate / 100);

  const baseTax    = ltcgTax + stcgTax + debtTax;
  const cessAmount = baseTax * (params.cess / 100);
  const totalTax   = baseTax + cessAmount;
  const annualNet  = annualGross - totalTax;

  return {
    annualGross,
    equityLtcgGains: ltcgGains,
    equityStcgGains: stcgGains,
    debtGains,
    ltcgTaxable,
    ltcgTax,
    stcgTax,
    debtTax,
    baseTax,
    cessAmount,
    totalTax,
    annualNet,
    monthlyNet: annualNet / 12,
    effectiveTaxRate: annualGross > 0 ? (totalTax / annualGross) * 100 : 0,
  };
}

/**
 * Calculate the gross withdrawal required to receive a given net amount after tax.
 * Uses binary search (Newton's method would work too but this is more readable).
 */
export function grossForNetWithdrawal(
  targetNet: number,
  params: TaxParams,
  tolerance = 1,
  maxIter = 60,
): number {
  if (targetNet <= 0) return 0;
  let lo = targetNet;
  let hi = targetNet * 3; // upper bound — tax rate can't exceed ~200%
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const { annualNet } = calcWithdrawalTax(mid, params);
    if (Math.abs(annualNet - targetNet) < tolerance) return mid;
    if (annualNet < targetNet) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
