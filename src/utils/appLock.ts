// App-lock orchestration: ties the key vault, the at-rest store, Google Drive recovery,
// and WebAuthn together. AppContext calls these; they own the keyVault table, the
// encrypt/decrypt migration, and the Drive recovery blob. Preferences (the `appLock`
// config + React state) are managed by AppContext around these calls.

import { db, KeyVaultRecord } from '../db/database';
import {
  generateDEK, wrapDEK, unwrapDEK, makeVerifier, checkVerifier,
  setSessionDEK, getSessionDEK, generateRecoveryCode, normalizeRecoveryCode,
} from './cloudSync/keyVault';
import { encryptAllAtRest, decryptAllAtRest, encryptSyncMetaAtRest, decryptSyncMetaAtRest } from './secureStore';
import { encryptAllAutoBackups, decryptAllAutoBackups } from './autoBackup';
import { writeRecoveryFile, readRecoveryFile, deleteRecoveryFile } from './cloudSync/google/drive';
import { signIn } from './cloudSync/google/gis';
import { registerPasskey, derivePrfSecret } from './webauthn';

const ESCROW_SENTINEL = 'drive-escrow';

interface RecoveryBlob {
  v: 1;
  verifier: string;
  recoveryCode?: string; // wrapped DEK
  escrowDEK?: string;    // plaintext DEK (Google-escrow — NOT zero-knowledge)
}

async function getVault(): Promise<KeyVaultRecord> {
  const vault = await db.keyVault.get(1);
  if (!vault) throw new Error('App lock is not set up.');
  return vault;
}

function requireSessionDEK(): string {
  const dek = getSessionDEK();
  if (!dek) throw new Error('App is locked — unlock before changing security settings.');
  return dek;
}

async function mergeRecoveryFile(patch: Partial<RecoveryBlob>, verifier: string): Promise<void> {
  let blob: RecoveryBlob = { v: 1, verifier };
  try {
    const raw = await readRecoveryFile();
    if (raw) blob = { ...(JSON.parse(raw) as RecoveryBlob), v: 1, verifier };
  } catch { /* no existing file */ }
  blob = { ...blob, ...patch };
  await writeRecoveryFile(JSON.stringify(blob));
}

// ── Enable / disable ──────────────────────────────────────────────────────────
/** Turn on the lock: generate a DEK, wrap with the passphrase, encrypt all data at rest. */
export async function enableAppLock(passphrase: string): Promise<void> {
  const dek = generateDEK();
  const vault: KeyVaultRecord = {
    id: 1,
    v: 1,
    slots: { passphrase: await wrapDEK(dek, passphrase) },
    verifier: await makeVerifier(dek),
    createdISO: new Date().toISOString(),
  };
  await db.keyVault.put(vault);
  setSessionDEK(dek);
  await encryptAllAtRest(dek);
  await encryptAllAutoBackups(dek);
  await encryptSyncMetaAtRest(dek);
}

/** Turn off the lock: decrypt all data back to plaintext and wipe key material. */
export async function disableAppLock(): Promise<void> {
  const dek = requireSessionDEK();
  await decryptAllAtRest(dek);
  await decryptAllAutoBackups(dek);
  await decryptSyncMetaAtRest(dek);
  await db.keyVault.delete(1);
  setSessionDEK(null);
  await deleteRecoveryFile().catch(() => { /* offline / not signed in */ });
}

/** Re-wrap the DEK under a new passphrase (must already be unlocked). */
export async function changeAppLockPassphrase(newPassphrase: string): Promise<void> {
  const dek = requireSessionDEK();
  const vault = await getVault();
  vault.slots.passphrase = await wrapDEK(dek, newPassphrase);
  await db.keyVault.put(vault);
}

// ── Recovery code (zero-knowledge) ────────────────────────────────────────────
/** Generate a recovery code, wrap the DEK with it, mirror to Drive. Returns the code once. */
export async function addRecoveryCode(): Promise<string> {
  const dek = requireSessionDEK();
  const vault = await getVault();
  const code = generateRecoveryCode();
  const wrapped = await wrapDEK(dek, normalizeRecoveryCode(code));
  vault.slots.recoveryCode = wrapped;
  await db.keyVault.put(vault);
  await mergeRecoveryFile({ recoveryCode: wrapped }, vault.verifier).catch(() => { /* offline */ });
  return code;
}

export async function removeRecoveryCode(): Promise<void> {
  const vault = await getVault();
  delete vault.slots.recoveryCode;
  await db.keyVault.put(vault);
  await mergeRecoveryFile({ recoveryCode: undefined }, vault.verifier).catch(() => { /* offline */ });
}

// ── Google-escrow recovery (NOT zero-knowledge) ───────────────────────────────
export async function enableGoogleEscrow(): Promise<void> {
  const dek = requireSessionDEK();
  await signIn(); // ensure a Drive session
  const vault = await getVault();
  await mergeRecoveryFile({ escrowDEK: dek }, vault.verifier);
  vault.slots.googleEscrow = ESCROW_SENTINEL;
  await db.keyVault.put(vault);
}

export async function disableGoogleEscrow(): Promise<void> {
  const vault = await getVault();
  await mergeRecoveryFile({ escrowDEK: undefined }, vault.verifier).catch(() => { /* offline */ });
  delete vault.slots.googleEscrow;
  await db.keyVault.put(vault);
}

// ── Passkey ────────────────────────────────────────────────────────────────────
export async function addPasskey(): Promise<void> {
  const dek = requireSessionDEK();
  const vault = await getVault();
  const { credentialId, prfSecret } = await registerPasskey();
  vault.slots.webauthn = { credentialId, wrapped: await wrapDEK(dek, prfSecret) };
  await db.keyVault.put(vault);
}

export async function removePasskey(): Promise<void> {
  const vault = await getVault();
  delete vault.slots.webauthn;
  await db.keyVault.put(vault);
}

// ── Unlock / recover (return the DEK on success, null on failure) ──────────────
/** Unlock with the daily passphrase. */
export async function unlockWithPassphrase(passphrase: string): Promise<string | null> {
  const vault = await db.keyVault.get(1);
  if (!vault?.slots.passphrase) return null;
  try {
    const dek = await unwrapDEK(vault.slots.passphrase, passphrase);
    return (await checkVerifier(dek, vault.verifier)) ? dek : null;
  } catch {
    return null;
  }
}

/** Unlock via passkey (PRF). */
export async function unlockWithPasskey(): Promise<string | null> {
  const vault = await db.keyVault.get(1);
  if (!vault?.slots.webauthn) return null;
  const prfSecret = await derivePrfSecret(vault.slots.webauthn.credentialId);
  try {
    const dek = await unwrapDEK(vault.slots.webauthn.wrapped, prfSecret);
    return (await checkVerifier(dek, vault.verifier)) ? dek : null;
  } catch {
    return null;
  }
}

/**
 * Recover with a recovery code. Falls back to the Drive recovery blob when the local
 * vault is absent (e.g. a fresh browser), so a saved code restores access anywhere.
 */
export async function recoverWithCode(code: string): Promise<string | null> {
  const vault = await db.keyVault.get(1);
  let wrapped = vault?.slots.recoveryCode;
  let verifier = vault?.verifier;
  if (!wrapped) {
    try {
      const raw = await readRecoveryFile();
      if (raw) {
        const blob = JSON.parse(raw) as RecoveryBlob;
        wrapped = blob.recoveryCode;
        verifier = blob.verifier;
      }
    } catch { /* offline / not signed in */ }
  }
  if (!wrapped || !verifier) return null;
  try {
    const dek = await unwrapDEK(wrapped, normalizeRecoveryCode(code));
    return (await checkVerifier(dek, verifier)) ? dek : null;
  } catch {
    return null;
  }
}

/** Recover via Google escrow. Forces re-consent so a live session can't silently unlock. */
export async function recoverWithGoogle(): Promise<string | null> {
  await signIn({ prompt: 'consent' });
  const raw = await readRecoveryFile();
  if (!raw) return null;
  const blob = JSON.parse(raw) as RecoveryBlob;
  if (blob.escrowDEK && blob.verifier && (await checkVerifier(blob.escrowDEK, blob.verifier))) {
    return blob.escrowDEK;
  }
  return null;
}
