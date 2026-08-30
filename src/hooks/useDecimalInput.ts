import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { resolveNumberLocale } from '../utils/currencies';

interface UseDecimalInputOptions {
  value: number;
  onCommit: (next: number) => void;
  precision?: number;
  min?: number;
  max?: number;
  allowNegative?: boolean;
  locale?: string;
  blankZero?: boolean; // show empty string instead of "0.00" when value is 0
}

interface UseDecimalInputReturn {
  inputProps: {
    type: 'text';
    inputMode: 'decimal';
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  /**
   * Force the display back to `value`'s formatted form.
   *
   * Needed because the resync effect below is driven by `value` *changing*. A
   * caller that commits and clears in the same tick (the add-item row: blur
   * commits 120000, then the commit resets to 0) leaves `value` at 0 both before
   * and after, so the effect never fires and the typed text lingers on screen.
   *
   * Pass the target explicitly when clearing, so the result does not depend on
   * whether a render landed between the commit and the clear.
   */
  reset: (to?: number) => void;
}

export function useDecimalInput({
  value,
  onCommit,
  precision = 2,
  min,
  max,
  allowNegative = false,
  locale,
  blankZero = false,
}: UseDecimalInputOptions): UseDecimalInputReturn {
  const resolvedLocale = locale ?? resolveNumberLocale('INR', undefined);
  const fmt = (n: number) =>
    new Intl.NumberFormat(resolvedLocale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(n);

  const [display, setDisplay] = useState(() => (blankZero && value === 0) ? '' : fmt(value));
  // rawRef tracks the in-progress text so onBlur always sees the latest typed value
  const rawRef = useRef(display);
  const focusedRef = useRef(false);

  // When value changes from outside while not focused, re-derive formatted display
  useEffect(() => {
    if (!focusedRef.current) {
      const next = (blankZero && value === 0) ? '' : fmt(value);
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
    // Reformat from the source-of-truth `value` prop, not the just-typed `next` — onCommit
    // may silently reject (e.g. a caller enforcing "> 0"), in which case `value` never
    // changes and this correctly snaps the display back instead of showing a stale number.
    // When onCommit does accept, the prop-driven effect above re-corrects this on next render.
    const resynced = (blankZero && value === 0) ? '' : fmt(value);
    setDisplay(resynced);
    rawRef.current = resynced;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  const reset = (to: number = value) => {
    const next = (blankZero && to === 0) ? '' : fmt(to);
    setDisplay(next);
    rawRef.current = next;
  };

  return {
    inputProps: {
      type: 'text',
      inputMode: 'decimal',
      value: display,
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
    },
    reset,
  };
}
