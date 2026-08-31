import { describe, it, expect } from 'vitest';
import {
  calcWithdrawalTax,
  grossForNetWithdrawal,
  DEFAULT_TAX_PARAMS,
  TAX_PRESETS,
  matchTaxJurisdiction,
} from '../taxCalculator';
import type { TaxParams } from '../../types';

// Helpers
function round2(n: number) { return Math.round(n * 100) / 100; }

const INDIA_2024 = DEFAULT_TAX_PARAMS; // 12.5% LTCG, 20% STCG, 30% debt, 4% cess, 80/70 split

describe('DEFAULT_TAX_PARAMS', () => {
  it('matches India Budget 2024 defaults', () => {
    expect(INDIA_2024.ltcgRate).toBe(12.5);
    expect(INDIA_2024.stcgRate).toBe(20);
    expect(INDIA_2024.ltcgExemption).toBe(125_000);
    expect(INDIA_2024.equityPct).toBe(80);
    expect(INDIA_2024.ltcgPct).toBe(70);
    expect(INDIA_2024.debtRate).toBe(30);
    expect(INDIA_2024.cess).toBe(4);
  });
});

describe('calcWithdrawalTax', () => {
  describe('zero withdrawal', () => {
    it('returns all zeros for zero gross', () => {
      const b = calcWithdrawalTax(0, INDIA_2024);
      expect(b.totalTax).toBe(0);
      expect(b.annualNet).toBe(0);
      expect(b.monthlyNet).toBe(0);
      expect(b.effectiveTaxRate).toBe(0);
    });
  });

  describe('basic corpus split', () => {
    it('splits withdrawal into equity and debt correctly', () => {
      // 100 units: 80 equity (56 LTCG, 24 STCG), 20 debt
      const b = calcWithdrawalTax(100, INDIA_2024);
      expect(round2(b.equityLtcgGains)).toBe(56); // 80 * 70%
      expect(round2(b.equityStcgGains)).toBe(24); // 80 * 30%
      expect(round2(b.debtGains)).toBe(20);        // 20%
    });
  });

  describe('LTCG exemption', () => {
    it('applies ₹1.25L exemption to LTCG gains', () => {
      // small corpus: LTCG gains well below exemption
      const b = calcWithdrawalTax(100_000, INDIA_2024);
      // ltcgGains = 100_000 * 0.8 * 0.7 = 56_000 < 125_000 exemption
      expect(b.ltcgTaxable).toBe(0);
      expect(b.ltcgTax).toBe(0);
    });

    it('taxes LTCG gains above exemption at ltcgRate', () => {
      // Large corpus: LTCG gains = 640_000 (> 125_000 exemption)
      const b = calcWithdrawalTax(1_000_000, INDIA_2024);
      // ltcgGains = 1_000_000 * 0.8 * 0.7 = 560_000
      // taxable = 560_000 - 125_000 = 435_000
      // tax = 435_000 * 12.5% = 54_375
      expect(round2(b.ltcgTaxable)).toBe(435_000);
      expect(round2(b.ltcgTax)).toBe(54_375);
    });
  });

  describe('STCG tax', () => {
    it('taxes full STCG gains at stcgRate (no exemption)', () => {
      const b = calcWithdrawalTax(1_000_000, INDIA_2024);
      // stcgGains = 1_000_000 * 0.8 * 0.3 = 240_000
      // tax = 240_000 * 20% = 48_000
      expect(round2(b.equityStcgGains)).toBe(240_000);
      expect(round2(b.stcgTax)).toBe(48_000);
    });
  });

  describe('debt tax', () => {
    it('taxes debt gains at debtRate', () => {
      const b = calcWithdrawalTax(1_000_000, INDIA_2024);
      // debtGains = 1_000_000 * 20% = 200_000
      // tax = 200_000 * 30% = 60_000
      expect(round2(b.debtGains)).toBe(200_000);
      expect(round2(b.debtTax)).toBe(60_000);
    });
  });

  describe('cess', () => {
    it('applies cess on base tax only', () => {
      const b = calcWithdrawalTax(1_000_000, INDIA_2024);
      const expectedBase = b.ltcgTax + b.stcgTax + b.debtTax;
      expect(round2(b.baseTax)).toBe(round2(expectedBase));
      expect(round2(b.cessAmount)).toBe(round2(expectedBase * 0.04));
    });
  });

  describe('effective tax rate', () => {
    it('is 0 when withdrawal is below LTCG exemption and all equity LTCG', () => {
      const allLtcgParams: TaxParams = {
        ...INDIA_2024,
        equityPct: 100,
        ltcgPct: 100,
        stcgRate: 0,
        debtRate: 0,
      };
      // withdrawal 100_000 < exemption 125_000 → no tax
      const b = calcWithdrawalTax(100_000, allLtcgParams);
      expect(b.effectiveTaxRate).toBe(0);
      expect(b.totalTax).toBe(0);
    });

    it('is between 0 and 100 for typical corpus withdrawal', () => {
      const b = calcWithdrawalTax(1_000_000, INDIA_2024);
      expect(b.effectiveTaxRate).toBeGreaterThan(0);
      expect(b.effectiveTaxRate).toBeLessThan(100);
    });

    it('net withdrawal equals gross minus total tax', () => {
      const gross = 800_000;
      const b = calcWithdrawalTax(gross, INDIA_2024);
      expect(round2(b.annualNet)).toBe(round2(gross - b.totalTax));
    });

    it('monthlyNet is annualNet / 12', () => {
      const b = calcWithdrawalTax(600_000, INDIA_2024);
      expect(round2(b.monthlyNet)).toBe(round2(b.annualNet / 12));
    });
  });

  describe('100% equity LTCG portfolio (no debt, no STCG)', () => {
    const pureEquityLtcg: TaxParams = {
      ltcgRate: 12.5, stcgRate: 0, ltcgExemption: 125_000,
      equityPct: 100, ltcgPct: 100, debtRate: 0, cess: 4,
    };

    it('pays no tax below exemption', () => {
      const b = calcWithdrawalTax(100_000, pureEquityLtcg);
      expect(b.totalTax).toBe(0);
    });

    it('pays 12.5% × cess on gains above ₹1.25L', () => {
      // gross = 2_00_000, ltcgGains = 2_00_000, taxable = 75_000
      // base = 75_000 * 12.5% = 9_375, cess = 375, total = 9_750
      const b = calcWithdrawalTax(200_000, pureEquityLtcg);
      expect(round2(b.ltcgTaxable)).toBe(75_000);
      expect(round2(b.baseTax)).toBe(9_375);
      expect(round2(b.cessAmount)).toBe(375);
      expect(round2(b.totalTax)).toBe(9_750);
    });
  });

  describe('custom tax params', () => {
    it('zero tax rates result in no tax', () => {
      const zeroTax: TaxParams = {
        ltcgRate: 0, stcgRate: 0, ltcgExemption: 0,
        equityPct: 80, ltcgPct: 70, debtRate: 0, cess: 0,
      };
      const b = calcWithdrawalTax(5_000_000, zeroTax);
      expect(b.totalTax).toBe(0);
      expect(b.effectiveTaxRate).toBe(0);
      expect(b.annualNet).toBe(5_000_000);
    });

    it('respects custom equity split', () => {
      const params: TaxParams = { ...INDIA_2024, equityPct: 50, ltcgPct: 50 };
      const b = calcWithdrawalTax(200_000, params);
      expect(round2(b.equityLtcgGains)).toBe(50_000); // 200_000 * 50% * 50%
      expect(round2(b.debtGains)).toBe(100_000);       // 200_000 * 50%
    });
  });
});

describe('grossForNetWithdrawal', () => {
  it('returns 0 for zero target', () => {
    expect(grossForNetWithdrawal(0, INDIA_2024)).toBe(0);
  });

  it('returns at least targetNet (gross ≥ net)', () => {
    const target = 500_000;
    const gross = grossForNetWithdrawal(target, INDIA_2024);
    expect(gross).toBeGreaterThanOrEqual(target);
  });

  it('round-trips through calcWithdrawalTax within tolerance', () => {
    const targetNet = 400_000;
    const gross = grossForNetWithdrawal(targetNet, INDIA_2024, 1);
    const { annualNet } = calcWithdrawalTax(gross, INDIA_2024);
    expect(Math.abs(annualNet - targetNet)).toBeLessThan(2);
  });

  it('with zero-tax params returns targetNet as gross', () => {
    const zeroTax: TaxParams = {
      ltcgRate: 0, stcgRate: 0, ltcgExemption: 0,
      equityPct: 80, ltcgPct: 70, debtRate: 0, cess: 0,
    };
    const target = 300_000;
    const gross = grossForNetWithdrawal(target, zeroTax, 1);
    expect(Math.abs(gross - target)).toBeLessThan(2);
  });
});

describe('TAX_PRESETS', () => {
  it('india preset is exactly DEFAULT_TAX_PARAMS — no silent divergence', () => {
    expect(TAX_PRESETS.india).toBe(DEFAULT_TAX_PARAMS);
  });

  it('us_approx has no cess and no LTCG exemption, unlike India', () => {
    expect(TAX_PRESETS.us_approx.cess).toBe(0);
    expect(TAX_PRESETS.us_approx.ltcgExemption).toBe(0);
  });
});

describe('matchTaxJurisdiction', () => {
  it('matches the india preset', () => {
    expect(matchTaxJurisdiction(DEFAULT_TAX_PARAMS)).toBe('india');
  });

  it('matches the us_approx preset', () => {
    expect(matchTaxJurisdiction(TAX_PRESETS.us_approx)).toBe('us_approx');
  });

  it('falls back to custom for hand-edited values', () => {
    expect(matchTaxJurisdiction({ ...DEFAULT_TAX_PARAMS, ltcgRate: 99 })).toBe('custom');
  });
});
