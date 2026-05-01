import React from 'react';

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

function abbreviateNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2) + 'Cr';
  if (abs >= 1_00_000)    return (n / 1_00_000).toFixed(2) + 'L';
  if (abs >= 1_000)       return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

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
    formatted = abbreviateNumber(abs);
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
