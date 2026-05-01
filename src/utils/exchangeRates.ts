/**
 * Live exchange rate fetching utility.
 *
 * Primary:  open.er-api.com  — free, no API key, 161+ currencies, updated daily
 *           https://open.er-api.com/v6/latest/{base}
 *
 * Fallback: api.frankfurter.app — ECB-backed, free, no API key, ~30 major currencies
 *           https://api.frankfurter.app/latest?from={base}&to={targets}
 *
 * The app stores exchangeRates as { USD: 83 } = "1 USD costs 83 INR" (1 foreign → X base).
 * Both APIs return "1 base = X foreign", so we invert each value before returning.
 */

export interface FetchRatesResult {
  rates: Record<string, number>;
  source: 'open.er-api' | 'frankfurter';
  updatedAt: string; // ISO timestamp
  unavailable: string[]; // currencies the API couldn't provide
}

const FETCH_TIMEOUT_MS = 8000;

function withTimeout(promise: Promise<Response>): Promise<Response> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out after 8s')), FETCH_TIMEOUT_MS)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Inverts a rate from "1 base = X foreign" to "1 foreign = X base".
 * Guards against division-by-zero.
 */
function invertRate(rate: number): number {
  return rate > 0 ? 1 / rate : 0;
}

/**
 * Fetches live rates for `targetCurrencies` against `baseCurrency`.
 * Tries Open Exchange Rates first; falls back to Frankfurter on failure.
 *
 * @param baseCurrency  - ISO code for the user's base currency (e.g. "INR")
 * @param targetCurrencies - array of foreign ISO codes to fetch (e.g. ["USD", "SGD", "EUR"])
 * @returns FetchRatesResult
 */
export async function fetchLiveRates(
  baseCurrency: string,
  targetCurrencies: string[]
): Promise<FetchRatesResult> {
  const targets = targetCurrencies.filter(c => c !== baseCurrency);
  if (targets.length === 0) {
    return { rates: {}, source: 'open.er-api', updatedAt: new Date().toISOString(), unavailable: [] };
  }

  // ── Primary: Open Exchange Rates (free, no key) ──────────────────────────
  try {
    const response = await withTimeout(
      fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`)
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.result !== 'success') throw new Error(`API error: ${data['error-type'] ?? 'unknown'}`);

    const rates: Record<string, number> = {};
    const unavailable: string[] = [];

    for (const currency of targets) {
      const raw = data.rates[currency];
      if (raw && raw > 0) {
        rates[currency] = invertRate(raw);
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
    fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}&to=${targetList}`)
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
      rates[currency] = invertRate(raw);
    } else {
      // Frankfurter doesn't cover all currencies (e.g. AED)
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
