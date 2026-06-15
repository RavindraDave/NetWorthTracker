import React, { useContext } from 'react';
import { formatCurrency, resolveNumberLocale } from '../../utils/currencies';
import { AppContext } from '../../context/AppContext';

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
  const ctx = useContext(AppContext);
  const locale = resolveNumberLocale(ctx?.preferences?.baseCurrency ?? 'INR', ctx?.preferences?.numberFormat);
  const formatted = formatCurrency(amount, currency, {
    compact: abbreviated || precision === 'compact',
    showSign,
    locale,
  });

  return <span className={className}>{formatted}</span>;
};
