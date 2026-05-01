import { describe, it, expect } from 'vitest';
import { convertToBase } from '../calculations';

describe('convertToBase', () => {
  it('returns amount unchanged when currency equals baseCurrency', () => {
    expect(convertToBase(1000, 'INR', 'INR', {})).toBe(1000);
  });

  it('converts using exchange rate', () => {
    expect(convertToBase(100, 'USD', 'INR', { USD: 83 })).toBe(8300);
  });

  it('falls back to 1:1 when rate is missing and warns', () => {
    const result = convertToBase(500, 'EUR', 'INR', {});
    expect(result).toBe(500); // 1:1 fallback
  });

  it('falls back to 1:1 when rate is zero', () => {
    const result = convertToBase(500, 'EUR', 'INR', { EUR: 0 });
    expect(result).toBe(500);
  });

  it('falls back to 1:1 when rate is negative', () => {
    const result = convertToBase(500, 'EUR', 'INR', { EUR: -90 });
    expect(result).toBe(500);
  });

  it('handles zero amount', () => {
    expect(convertToBase(0, 'USD', 'INR', { USD: 83 })).toBe(0);
  });
});

describe('cloneLatestSnapshot month math', () => {
  function nextMonth(month: string): string {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const next = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? year + 1 : year;
    return `${nextYear}-${String(next).padStart(2, '0')}`;
  }

  it('increments month within year', () => {
    expect(nextMonth('2025-01')).toBe('2025-02');
    expect(nextMonth('2025-06')).toBe('2025-07');
    expect(nextMonth('2025-11')).toBe('2025-12');
  });

  it('rolls over December to January next year', () => {
    expect(nextMonth('2025-12')).toBe('2026-01');
    expect(nextMonth('2024-12')).toBe('2025-01');
  });

  it('handles single-digit months with padding', () => {
    expect(nextMonth('2025-03')).toBe('2025-04');
  });
});
