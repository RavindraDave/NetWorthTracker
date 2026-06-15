export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

// Comprehensive currency list (80+ currencies)
export const ALL_CURRENCIES: Currency[] = [
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'AFN', symbol: '؋', name: 'Afghan Afghani' },
  { code: 'ALL', symbol: 'L', name: 'Albanian Lek' },
  { code: 'AMD', symbol: '֏', name: 'Armenian Dram' },
  { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'AZN', symbol: '₼', name: 'Azerbaijani Manat' },
  { code: 'BAM', symbol: 'KM', name: 'Bosnia Mark' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar' },
  { code: 'BND', symbol: 'B$', name: 'Brunei Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'BWP', symbol: 'P', name: 'Botswana Pula' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CLP', symbol: '$', name: 'Chilean Peso' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'COP', symbol: '$', name: 'Colombian Peso' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'DZD', symbol: 'دج', name: 'Algerian Dinar' },
  { code: 'EGP', symbol: '£', name: 'Egyptian Pound' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'IQD', symbol: 'ع.د', name: 'Iraqi Dinar' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna' },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' },
  { code: 'LBP', symbol: 'L£', name: 'Lebanese Pound' },
  { code: 'LKR', symbol: '₨', name: 'Sri Lankan Rupee' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'NPR', symbol: '₨', name: 'Nepalese Rupee' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'UZS', symbol: 'сўм', name: 'Uzbekistani Som' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha' },
];

// Legacy small list kept for backward compat
export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

export const CURRENCY_MAP = new Map(ALL_CURRENCIES.map(c => [c.code, c]));

export const getCurrencySymbol = (code: string): string => {
  return CURRENCY_MAP.get(code)?.symbol ?? code;
};

import { formatCompactNumber } from './numberFormat';

export type NumberFormatPreference = 'auto' | 'lakh' | 'international';

/** Currencies whose home regions conventionally group digits as lakh/crore (e.g. 12,34,567). */
const LAKH_GROUPING_CURRENCIES = new Set(['INR', 'NPR', 'PKR', 'BDT', 'LKR']);

/**
 * Resolve the digit-grouping locale to use for displayed amounts.
 * 'lakh'/'international' pin the choice explicitly; 'auto' (or unset)
 * derives it from the base currency.
 */
export const resolveNumberLocale = (baseCurrency: string, preference?: NumberFormatPreference): string => {
  if (preference === 'lakh') return 'en-IN';
  if (preference === 'international') return 'en-US';
  return LAKH_GROUPING_CURRENCIES.has(baseCurrency) ? 'en-IN' : 'en-US';
};

export interface FormatCurrencyOptions {
  compact?: boolean;
  precision?: number;
  locale?: string;
  showSign?: boolean;
}

export const formatCurrency = (
  amount: number,
  currencyCode: string,
  options: FormatCurrencyOptions = {}
): string => {
  const { compact = false, precision = 2, locale = 'en-IN', showSign = false } = options;
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const sign = showSign ? (isNeg ? '−' : '+') : (isNeg ? '−' : '');

  if (compact) {
    return sign + getCurrencySymbol(currencyCode) + formatCompactNumber(abs);
  }

  try {
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(abs);
    return sign ? sign + fmt : fmt;
  } catch {
    const sym = getCurrencySymbol(currencyCode);
    const fallback = abs.toLocaleString(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
    return sign + sym + fallback;
  }
};
