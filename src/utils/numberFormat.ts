export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000)    return `${(value / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)       return `${(value / 1_000).toFixed(0)}K`;
  return String(Math.round(value));
}

/**
 * Parse a locale-aware amount string into a number.
 * Handles European (1.234,56), US (1,234.56), and bare formats.
 */
export function parseAmount(raw: string): number {
  const s = raw.trim().replace(/[^\d.,\-]/g, '');
  if (!s || s === '-') return 0;
  const negative = s.startsWith('-');
  const abs = s.replace(/^-/, '');
  const lastComma = abs.lastIndexOf(',');
  const lastDot = abs.lastIndexOf('.');
  let value: number;
  if (lastComma !== -1 && lastDot !== -1) {
    // Both separators present — whichever comes last is the decimal separator
    if (lastComma > lastDot) {
      value = parseFloat(abs.replace(/\./g, '').replace(',', '.'));
    } else {
      value = parseFloat(abs.replace(/,/g, ''));
    }
  } else if (lastComma !== -1) {
    // Comma only — if exactly 3 digits follow, treat as thousands separator
    const afterComma = abs.slice(lastComma + 1);
    if (afterComma.length === 3) {
      value = parseFloat(abs.replace(',', ''));
    } else {
      value = parseFloat(abs.replace(',', '.'));
    }
  } else {
    value = parseFloat(abs);
  }
  const result = Number.isFinite(value) ? value : 0;
  return negative ? -result : result;
}
