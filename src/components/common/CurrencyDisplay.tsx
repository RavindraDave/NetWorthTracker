import React from 'react';
import { formatCompactNumber } from '../../utils/numberFormat';

interface CurrencyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  abbreviated?: boolean;
  showSign?: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', SGD: 'S$', EUR: '€', GBP: '£', AED: 'د.إ',
  AUD: 'A$', CAD: 'C$', JPY: '¥', CHF: 'Fr', HKD: 'HK$', NZD: 'NZ$',
};

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  currency = 'INR',
  className = '',
  abbreviated = false,
  showSign = false,
}) => {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);

  let formatted: string;
  if (abbreviated) {
    formatted = formatCompactNumber(abs);
  } else {
    if (currency === 'INR') {
      formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    } else {
      formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
  }

  const sign = showSign ? (isNeg ? '−' : '+') : (isNeg ? '−' : '');

  return (
    <span className={className}>
      {sign}{symbol}{formatted}
    </span>
  );
};
