import React from 'react';
import { formatCurrency } from '../../utils/currencies';

interface CurrencyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  precision?: 'full' | 'compact';
  showSign?: boolean;
  /** @deprecated use precision="compact" */
  abbreviated?: boolean;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  currency = 'INR',
  className = '',
  precision = 'full',
  showSign = false,
  abbreviated = false,
}) => {
  const formatted = formatCurrency(amount, currency, {
    compact: abbreviated || precision === 'compact',
    showSign,
  });

  return <span className={className}>{formatted}</span>;
};
