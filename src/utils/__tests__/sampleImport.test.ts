import { describe, it, expect } from 'vitest';
import { buildSampleCsv } from '../sampleImport';
import { CSV_FIELDS } from '../../hooks/useCsvParser';

describe('buildSampleCsv', () => {
  it('header row exactly matches CSV_FIELDS — the guarantee this file exists to keep', () => {
    const [headerLine] = buildSampleCsv().split('\n');
    expect(headerLine.split(',')).toEqual(CSV_FIELDS);
  });

  it('every data row has one value per column, including empty optional ones', () => {
    const lines = buildSampleCsv().split('\n').slice(1);
    for (const line of lines) {
      expect(line.split(',')).toHaveLength(CSV_FIELDS.length);
    }
  });

  it('maps to at least one asset and one liability, so both Type values are demonstrated', () => {
    const csv = buildSampleCsv();
    expect(csv).toContain(',asset,');
    expect(csv).toContain(',liability');
  });

  it('is non-empty and has more than just a header row', () => {
    const lines = buildSampleCsv().split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });
});
