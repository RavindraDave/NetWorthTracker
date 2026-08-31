import { describe, it, expect } from 'vitest';
import { backoffSeconds, isLockedOut, secondsRemaining, recordFailure, recordSuccess } from '../appLockThrottle';
import { AppLockConfig } from '../../types';

function lock(overrides: Partial<AppLockConfig> = {}): AppLockConfig {
  return { enabled: true, autoLockMinutes: 15, recovery: { code: false, googleEscrow: false }, ...overrides };
}

describe('backoffSeconds', () => {
  it('is free for the first two failures', () => {
    expect(backoffSeconds(0)).toBe(0);
    expect(backoffSeconds(1)).toBe(0);
    expect(backoffSeconds(2)).toBe(0);
  });

  it('grows exponentially from the 3rd failure, capped at 5 minutes', () => {
    expect(backoffSeconds(3)).toBe(10);
    expect(backoffSeconds(4)).toBe(20);
    expect(backoffSeconds(5)).toBe(40);
    expect(backoffSeconds(20)).toBe(300); // capped
  });
});

describe('isLockedOut / secondsRemaining', () => {
  const now = new Date('2026-08-31T12:00:00Z');

  it('is not locked out with no lockedUntilISO', () => {
    expect(isLockedOut(lock(), now)).toBe(false);
    expect(secondsRemaining(lock(), now)).toBe(0);
  });

  it('is locked out while lockedUntilISO is in the future', () => {
    const l = lock({ lockedUntilISO: new Date(now.getTime() + 30_000).toISOString() });
    expect(isLockedOut(l, now)).toBe(true);
    expect(secondsRemaining(l, now)).toBe(30);
  });

  it('is not locked out once lockedUntilISO has passed', () => {
    const l = lock({ lockedUntilISO: new Date(now.getTime() - 1000).toISOString() });
    expect(isLockedOut(l, now)).toBe(false);
    expect(secondsRemaining(l, now)).toBe(0);
  });

  it('treats an undefined lock (feature never configured) as not locked out', () => {
    expect(isLockedOut(undefined, now)).toBe(false);
  });
});

describe('recordFailure / recordSuccess', () => {
  const now = new Date('2026-08-31T12:00:00Z');

  it('increments failedAttempts and sets no lockout within the free window', () => {
    const patch = recordFailure(lock({ failedAttempts: 1 }), now);
    expect(patch.failedAttempts).toBe(2);
    expect(patch.lockedUntilISO).toBeUndefined();
  });

  it('sets a lockedUntilISO once past the free window', () => {
    const patch = recordFailure(lock({ failedAttempts: 2 }), now);
    expect(patch.failedAttempts).toBe(3);
    expect(patch.lockedUntilISO).toBe(new Date(now.getTime() + 10_000).toISOString());
  });

  it('treats an undefined lock as zero prior failures', () => {
    expect(recordFailure(undefined, now).failedAttempts).toBe(1);
  });

  it('resets both fields on success', () => {
    expect(recordSuccess()).toEqual({ failedAttempts: 0, lockedUntilISO: undefined });
  });
});
