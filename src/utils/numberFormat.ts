export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000)    return `${(value / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)       return `${(value / 1_000).toFixed(0)}K`;
  return String(Math.round(value));
}
