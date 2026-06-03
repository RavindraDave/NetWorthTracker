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
