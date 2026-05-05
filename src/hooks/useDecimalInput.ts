import { useState, useEffect, useRef } from 'react';
import type React from 'react';

interface UseDecimalInputOptions {
  value: number;
  onCommit: (next: number) => void;
  precision?: number;
  min?: number;
  max?: number;
  allowNegative?: boolean;
  locale?: string;
}

interface UseDecimalInputReturn {
  inputProps: {
    type: 'text';
    inputMode: 'decimal';
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
  };
}

export function useDecimalInput({
  value,
  onCommit,
  precision = 2,
  min,
  max,
  allowNegative = false,
  locale = 'en-IN',
}: UseDecimalInputOptions): UseDecimalInputReturn {
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(n);

  const [display, setDisplay] = useState(() => fmt(value));
  // rawRef tracks the in-progress text so onBlur always sees the latest typed value
  const rawRef = useRef(display);
  const focusedRef = useRef(false);

  // When value changes from outside while not focused, re-derive formatted display
  useEffect(() => {
    if (!focusedRef.current) {
      const next = fmt(value);
      setDisplay(next);
      rawRef.current = next;
    }
    // fmt is stable within a render; disable exhaustive-deps for it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
    if (raw === '' || pattern.test(raw)) {
      rawRef.current = raw;
      setDisplay(raw);
    }
  };

  const onFocus = () => {
    focusedRef.current = true;
    const raw = value === 0 ? '' : String(value);
    rawRef.current = raw;
    setDisplay(raw);
  };

  const onBlur = () => {
    focusedRef.current = false;
    const parsed = parseFloat(rawRef.current);
    let next = isNaN(parsed) ? 0 : parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    const factor = Math.pow(10, precision);
    next = Math.round(next * factor) / factor;
    onCommit(next);
    const formatted = fmt(next);
    setDisplay(formatted);
    rawRef.current = formatted;
  };

  return {
    inputProps: {
      type: 'text',
      inputMode: 'decimal',
      value: display,
      onChange,
      onFocus,
      onBlur,
    },
  };
}
