import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDecimalInput } from '../useDecimalInput';

function makeChangeEvent(value: string): React.ChangeEvent<HTMLInputElement> {
  return { target: { value } } as React.ChangeEvent<HTMLInputElement>;
}

describe('useDecimalInput — initial display', () => {
  it('formats value with default precision=2', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 1234.5, onCommit: vi.fn(), locale: 'en-US' })
    );
    expect(result.current.inputProps.value).toBe('1,234.50');
  });

  it('shows empty string for zero when blankZero=true', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit: vi.fn(), blankZero: true, locale: 'en-US' })
    );
    expect(result.current.inputProps.value).toBe('');
  });

  it('shows "0.00" for zero when blankZero is false (default)', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit: vi.fn(), locale: 'en-US' })
    );
    expect(result.current.inputProps.value).toBe('0.00');
  });

  it('respects custom precision', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 1.5, onCommit: vi.fn(), precision: 0, locale: 'en-US' })
    );
    expect(result.current.inputProps.value).toBe('2');
  });
});

describe('useDecimalInput — onFocus / onBlur', () => {
  it('clears formatted value to raw number on focus (non-zero)', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 1234.5, onCommit: vi.fn(), locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    expect(result.current.inputProps.value).toBe('1234.5');
  });

  it('clears to empty string on focus when value is 0', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit: vi.fn(), locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    expect(result.current.inputProps.value).toBe('');
  });

  it('calls onCommit with parsed value on blur', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit, locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    act(() => result.current.inputProps.onChange(makeChangeEvent('500')));
    act(() => result.current.inputProps.onBlur());
    expect(onCommit).toHaveBeenCalledWith(500);
  });

  it('commits 0 when input is cleared on blur', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDecimalInput({ value: 100, onCommit, locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    act(() => result.current.inputProps.onChange(makeChangeEvent('')));
    act(() => result.current.inputProps.onBlur());
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it('re-formats value after blur', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit: vi.fn(), locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    act(() => result.current.inputProps.onChange(makeChangeEvent('1000')));
    act(() => result.current.inputProps.onBlur());
    expect(result.current.inputProps.value).toBe('1,000.00');
  });
});

describe('useDecimalInput — min/max clamping', () => {
  it('clamps value to min on blur', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit, min: 10, locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    act(() => result.current.inputProps.onChange(makeChangeEvent('5')));
    act(() => result.current.inputProps.onBlur());
    expect(onCommit).toHaveBeenCalledWith(10);
  });

  it('clamps value to max on blur', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit, max: 100, locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    act(() => result.current.inputProps.onChange(makeChangeEvent('999')));
    act(() => result.current.inputProps.onBlur());
    expect(onCommit).toHaveBeenCalledWith(100);
  });
});

describe('useDecimalInput — allowNegative', () => {
  it('rejects negative input when allowNegative=false (default)', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit: vi.fn(), locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    act(() => result.current.inputProps.onChange(makeChangeEvent('-50')));
    expect(result.current.inputProps.value).toBe('');
  });

  it('accepts negative input when allowNegative=true', () => {
    const { result } = renderHook(() =>
      useDecimalInput({ value: 0, onCommit: vi.fn(), allowNegative: true, locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    act(() => result.current.inputProps.onChange(makeChangeEvent('-50')));
    expect(result.current.inputProps.value).toBe('-50');
  });
});

describe('useDecimalInput — external value updates', () => {
  it('updates display when value prop changes while not focused', () => {
    let value = 100;
    const { result, rerender } = renderHook(() =>
      useDecimalInput({ value, onCommit: vi.fn(), locale: 'en-US' })
    );
    expect(result.current.inputProps.value).toBe('100.00');
    value = 200;
    rerender();
    expect(result.current.inputProps.value).toBe('200.00');
  });

  it('does not override display while focused', () => {
    let value = 100;
    const { result, rerender } = renderHook(() =>
      useDecimalInput({ value, onCommit: vi.fn(), locale: 'en-US' })
    );
    act(() => result.current.inputProps.onFocus());
    act(() => result.current.inputProps.onChange(makeChangeEvent('999')));
    value = 200;
    rerender();
    expect(result.current.inputProps.value).toBe('999');
  });
});
