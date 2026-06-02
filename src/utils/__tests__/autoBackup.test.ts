import { describe, it, expect } from 'vitest';
import { daysSinceISO, staleThresholdDays } from '../autoBackup';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('daysSinceISO', () => {
  it('returns Infinity when the timestamp is missing', () => {
    expect(daysSinceISO(undefined)).toBe(Infinity);
  });

  it('returns 0 for a timestamp from just now', () => {
    expect(daysSinceISO(new Date().toISOString())).toBe(0);
  });

  it('floors a recent timestamp to whole days', () => {
    const iso = new Date(Date.now() - 5 * MS_PER_DAY - 1000).toISOString();
    expect(daysSinceISO(iso)).toBe(5);
  });

  it('counts an old timestamp correctly', () => {
    const iso = new Date(Date.now() - 40 * MS_PER_DAY).toISOString();
    expect(daysSinceISO(iso)).toBe(40);
  });
});

describe('staleThresholdDays', () => {
  it('nags soonest for daily cadence', () => {
    expect(staleThresholdDays('daily')).toBe(3);
  });

  it('uses a mid threshold for weekly cadence', () => {
    expect(staleThresholdDays('weekly')).toBe(10);
  });

  it('allows a longer window for monthly cadence', () => {
    expect(staleThresholdDays('monthly')).toBe(35);
  });

  it('falls back to 30 days when backups are off', () => {
    expect(staleThresholdDays('off')).toBe(30);
  });

  it('falls back to 30 days when cadence is unset', () => {
    expect(staleThresholdDays(undefined)).toBe(30);
  });
});
