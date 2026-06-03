import { describe, it, expect } from 'vitest';
import { formatCompactNumber, parseAmount } from '../numberFormat';

describe('formatCompactNumber', () => {
  it('formats crores', () => {
    expect(formatCompactNumber(1_00_00_000)).toBe('1.0Cr');
    expect(formatCompactNumber(2_50_00_000)).toBe('2.5Cr');
  });

  it('formats lakhs', () => {
    expect(formatCompactNumber(1_00_000)).toBe('1.0L');
    expect(formatCompactNumber(12_50_000)).toBe('12.5L');
  });

  it('formats thousands', () => {
    expect(formatCompactNumber(5_000)).toBe('5K');
    expect(formatCompactNumber(99_999)).toBe('100K');
  });

  it('formats small numbers as-is', () => {
    expect(formatCompactNumber(500)).toBe('500');
    expect(formatCompactNumber(0)).toBe('0');
  });

  it('handles negative values', () => {
    expect(formatCompactNumber(-1_00_000)).toBe('-1.0L');
  });
});

describe('parseAmount', () => {
  describe('US format (dot as decimal)', () => {
    it('parses integer', () => expect(parseAmount('1234')).toBe(1234));
    it('parses with comma thousands separator', () => expect(parseAmount('1,234.56')).toBe(1234.56));
    it('parses without separator', () => expect(parseAmount('1234.56')).toBe(1234.56));
    it('parses large US amount', () => expect(parseAmount('1,234,567.89')).toBe(1234567.89));
  });

  describe('European format (comma as decimal)', () => {
    it('parses European decimal', () => expect(parseAmount('1.234,56')).toBe(1234.56));
    it('parses simple comma decimal', () => expect(parseAmount('1234,56')).toBe(1234.56));
    it('parses large European amount', () => expect(parseAmount('1.234.567,89')).toBe(1234567.89));
  });

  describe('ambiguous comma-only', () => {
    it('treats comma with 3 trailing digits as thousands separator', () => {
      // "1,234" → 1234 (thousands), not 1.234
      expect(parseAmount('1,234')).toBe(1234);
    });

    it('treats comma with non-3 trailing digits as decimal', () => {
      // "1,5" → 1.5
      expect(parseAmount('1,5')).toBe(1.5);
      // "1,25" → 1.25
      expect(parseAmount('1,25')).toBe(1.25);
    });
  });

  describe('currency symbols and whitespace', () => {
    it('strips leading currency symbol', () => expect(parseAmount('₹1,234.56')).toBe(1234.56));
    it('strips dollar sign', () => expect(parseAmount('$5,000.00')).toBe(5000));
    it('strips whitespace', () => expect(parseAmount('  1234.56  ')).toBe(1234.56));
    it('strips euro sign', () => expect(parseAmount('€1.234,56')).toBe(1234.56));
  });

  describe('negative values', () => {
    it('handles leading minus', () => expect(parseAmount('-1234.56')).toBe(-1234.56));
    it('handles negative European', () => expect(parseAmount('-1.234,56')).toBe(-1234.56));
  });

  describe('edge cases', () => {
    it('returns 0 for empty string', () => expect(parseAmount('')).toBe(0));
    it('returns 0 for non-numeric string', () => expect(parseAmount('N/A')).toBe(0));
    it('returns 0 for bare minus', () => expect(parseAmount('-')).toBe(0));
    it('parses zero', () => expect(parseAmount('0')).toBe(0));
    it('parses "0.00"', () => expect(parseAmount('0.00')).toBe(0));
  });
});
