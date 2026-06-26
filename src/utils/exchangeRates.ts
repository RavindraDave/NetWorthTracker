/**
 * Live exchange rate fetching utility.
 *
 * Primary:  open.er-api.com  — free, no API key, 161+ currencies, updated daily
 *           https://open.er-api.com/v6/latest/USD
 *
 * Fallback: api.frankfurter.app — ECB-backed, free, no API key, ~30 major currencies
 *           https://api.frankfurter.app/latest?from=USD&to={targets}
 *
 * The app stores rates in anchor-relative format: { INR: 83, SGD: 1.34 } = "1 USD = X currency".
 * Both APIs return "1 USD = X foreign" when queried with USD as base — stored as-is, no inversion.
 */

export interface FetchRatesResult {
  rates: Record<string, number>;
  source: 'open.er-api' | 'frankfurter';
  updatedAt: string; // ISO timestamp
  unavailable: string[]; // currencies the API couldn't provide
}

const FETCH_TIMEOUT_MS = 8000;
const ANCHOR = 'USD';

function withTimeout(promise: Promise<Response>): Promise<Response> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out after 8s')), FETCH_TIMEOUT_MS)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Fetches live rates for `targetCurrencies` against the USD anchor.
 * Returned rates are in anchor format: { INR: 83, SGD: 1.34 } = "1 USD = X currency".
 * No inversion is applied — the APIs return this format natively when queried from USD.
 *
 * Tries Open Exchange Rates first; falls back to Frankfurter on failure.
 */
export async function fetchAnchorRates(
  targetCurrencies: string[]
): Promise<FetchRatesResult> {
  const targets = targetCurrencies.filter(c => c !== ANCHOR);
  if (targets.length === 0) {
    return { rates: {}, source: 'open.er-api', updatedAt: new Date().toISOString(), unavailable: [] };
  }

  // ── Primary: Open Exchange Rates (free, no key) ──────────────────────────
  try {
    const response = await withTimeout(
      fetch(`https://open.er-api.com/v6/latest/${ANCHOR}`)
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.result !== 'success') throw new Error(`API error: ${data['error-type'] ?? 'unknown'}`);

    const rates: Record<string, number> = {};
    const unavailable: string[] = [];

    for (const currency of targets) {
      const raw = data.rates[currency];
      if (raw && raw > 0) {
        rates[currency] = raw; // "1 USD = raw currency" — stored as-is
      } else {
        unavailable.push(currency);
      }
    }

    return {
      rates,
      source: 'open.er-api',
      updatedAt: data.time_last_update_utc
        ? new Date(data.time_last_update_utc).toISOString()
        : new Date().toISOString(),
      unavailable,
    };
  } catch (primaryErr) {
    console.warn('[ExchangeRates] Primary API failed, trying Frankfurter fallback:', primaryErr);
  }

  // ── Fallback: Frankfurter (ECB-backed, major currencies only) ────────────
  const targetList = targets.join(',');
  const response = await withTimeout(
    fetch(`https://api.frankfurter.app/latest?from=${ANCHOR}&to=${targetList}`)
  );

  if (!response.ok) {
    throw new Error(
      `Both exchange rate providers failed. ` +
      `Frankfurter responded with HTTP ${response.status}. ` +
      `Please update rates manually.`
    );
  }

  const data = await response.json();
  const rates: Record<string, number> = {};
  const unavailable: string[] = [];

  for (const currency of targets) {
    const raw = data.rates?.[currency];
    if (raw && raw > 0) {
      rates[currency] = raw; // "1 USD = raw currency" — stored as-is
    } else {
      unavailable.push(currency);
    }
  }

  return {
    rates,
    source: 'frankfurter',
    updatedAt: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    unavailable,
  };
}
