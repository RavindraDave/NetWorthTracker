import { Snapshot } from '../types';
import { RATE_ANCHOR } from './calculations';

/**
 * One-time migration from old base-relative rates ("1 foreign = X base") to
 * anchor-relative rates ("1 USD = X currency"). Detected by absence of ratesAnchor.
 *
 * Normal case (e.g. INR base):
 *   old { USD: 83, SGD: 62 }  →  new { INR: 83, SGD: 83/62 ≈ 1.34 }
 *   Derivation: "1 USD = usdToBase base" and "1 foreign = oldRate base"
 *               → "1 USD = usdToBase/oldRate foreign"
 *
 * USD-as-base case (no USD key in old rates):
 *   old { EUR: 0.92, SGD: 0.75 }  →  new { EUR: 1/0.92 ≈ 1.087, SGD: 1/0.75 ≈ 1.333 }
 *   Derivation: "1 foreign = oldRate USD" → "1 USD = 1/oldRate foreign"
 *
 * Unknown case (non-USD base, USD rate missing):
 *   Clear rates → MissingRateBanner fires, user refreshes.
 *
 * KNOWN LIMITATION: if the user changed their base currency after creating
 * snapshots, migration uses the *current* baseCurrency which may not match
 * the historical base. The derived rates will be wrong, but MissingRateBanner
 * won't fire (rates exist). Refreshing live rates corrects this.
 */
export function migrateToAnchorRates(snap: Snapshot, baseCurrency: string): Snapshot {
  if (snap.ratesAnchor === RATE_ANCHOR) return snap; // already migrated

  const oldRates = snap.exchangeRates;
  const usdToBase = oldRates[RATE_ANCHOR]; // old "1 USD = usdToBase base"

  if (!usdToBase || usdToBase <= 0) {
    if (baseCurrency === RATE_ANCHOR) {
      // USD was the base — old rates are "1 foreign = X USD"; invert to anchor-relative
      const newRates: Record<string, number> = {};
      for (const [currency, oldRate] of Object.entries(oldRates)) {
        if (currency !== RATE_ANCHOR && oldRate > 0) {
          newRates[currency] = 1 / oldRate; // "1 USD = 1/oldRate foreign"
        }
      }
      return { ...snap, exchangeRates: newRates, ratesAnchor: RATE_ANCHOR };
    }
    // Non-USD base with no USD reference — can't derive anchor rates
    return { ...snap, exchangeRates: {}, ratesAnchor: RATE_ANCHOR };
  }

  const newRates: Record<string, number> = {};
  newRates[baseCurrency] = usdToBase; // "1 USD = usdToBase baseCurrency"

  for (const [currency, oldRate] of Object.entries(oldRates)) {
    if (currency === RATE_ANCHOR || currency === baseCurrency) continue;
    if (oldRate > 0) {
      newRates[currency] = usdToBase / oldRate; // "1 USD = usdToBase/oldRate foreign"
    }
  }

  return { ...snap, exchangeRates: newRates, ratesAnchor: RATE_ANCHOR };
}
