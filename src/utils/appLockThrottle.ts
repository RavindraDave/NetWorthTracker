/**
 * Local exponential backoff for App Lock's passphrase unlock — the weakest
 * link in an otherwise well-reasoned local-crypto design: nothing previously
 * throttled repeated guesses against a stolen IndexedDB blob, relying on
 * PBKDF2 cost alone.
 *
 * Threat-model honesty: this defends against a CASUAL local attacker (a
 * nosy family member on a shared PC), not a sophisticated one — anyone with
 * DevTools/IndexedDB access can trivially edit `lockedUntilISO` back to the
 * past or delete the whole `preferences` record to reset the counter. That's
 * consistent with App Lock's own documented threat model elsewhere; this
 * doesn't oversell what it defends against.
 *
 * State lives in `preferences.appLock` (plaintext, readable pre-unlock —
 * confirmed correct in `AppContext.load()`) rather than anywhere encrypted,
 * so it must be written via a path that skips `recordAutoBackup` (see
 * `updatePreferences`'s `skipBackup` option) — routing it through the normal
 * path would let a brute-force loop spam the auto-backup table and evict
 * real recovery backups.
 */
import { AppLockConfig } from '../types';

const FREE_ATTEMPTS = 2;
const BASE_SECONDS = 10;
const MAX_SECONDS = 300; // 5 minutes

/** Seconds to wait after N consecutive failures. Free for the first two. */
export function backoffSeconds(failedAttempts: number): number {
  if (failedAttempts <= FREE_ATTEMPTS) return 0;
  const exponent = failedAttempts - FREE_ATTEMPTS - 1; // 0 on the 3rd failure
  return Math.min(BASE_SECONDS * Math.pow(2, exponent), MAX_SECONDS);
}

export function isLockedOut(lock: AppLockConfig | undefined, now: Date = new Date()): boolean {
  if (!lock?.lockedUntilISO) return false;
  return new Date(lock.lockedUntilISO) > now;
}

/** Seconds remaining in an active lockout, 0 if none. For the countdown UI. */
export function secondsRemaining(lock: AppLockConfig | undefined, now: Date = new Date()): number {
  if (!lock?.lockedUntilISO) return 0;
  const ms = new Date(lock.lockedUntilISO).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

export function recordFailure(lock: AppLockConfig | undefined, now: Date = new Date()): Pick<AppLockConfig, 'failedAttempts' | 'lockedUntilISO'> {
  const failedAttempts = (lock?.failedAttempts ?? 0) + 1;
  const seconds = backoffSeconds(failedAttempts);
  return {
    failedAttempts,
    lockedUntilISO: seconds > 0 ? new Date(now.getTime() + seconds * 1000).toISOString() : undefined,
  };
}

export function recordSuccess(): Pick<AppLockConfig, 'failedAttempts' | 'lockedUntilISO'> {
  return { failedAttempts: 0, lockedUntilISO: undefined };
}
