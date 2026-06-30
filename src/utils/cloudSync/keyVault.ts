// App-lock key vault: DEK-envelope crypto for encryption-at-rest.
//
// A single random Data Encryption Key (DEK) encrypts IndexedDB records. The DEK is
// itself wrapped (encrypted) by one or more "unlock" secrets — a passphrase, a recovery
// code, a passkey-derived secret — so any one of them can recover it. Adding or removing
// an unlock method only re-wraps the 32-byte DEK; the data is never re-encrypted.
//
// Wrapping reuses the existing AES-GCM-256 + PBKDF2 envelope from encryption.ts (zero new
// primitives). Record encryption uses the raw DEK directly via AES-GCM.

import { encryptJSON, decryptJSON } from './encryption';

/** A DEK wrapped by an unlock secret — a JSON `EncryptionEnvelope` string. */
export type WrappedKey = string;

const VERIFIER_PLAINTEXT = 'wealthpulse-keyvault-verifier-v1';

// ── base64 (encryption.ts keeps its own helpers private) ─────────────────────
function toBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

function fromBase64(s: string): ArrayBuffer {
  const binary = atob(s);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

// ── DEK generation / import ──────────────────────────────────────────────────
/** Generate a fresh 256-bit DEK, returned as base64. */
export function generateDEK(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)));
}

async function importDEK(dekB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(dekB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// ── Wrapping (key slots) ─────────────────────────────────────────────────────
/** Wrap the DEK with an unlock secret (passphrase / recovery code / PRF secret). */
export function wrapDEK(dekB64: string, secret: string): Promise<WrappedKey> {
  return encryptJSON(dekB64, secret);
}

/** Unwrap the DEK with an unlock secret. Throws if the secret is wrong. */
export function unwrapDEK(wrapped: WrappedKey, secret: string): Promise<string> {
  return decryptJSON(wrapped, secret);
}

// ── Record encryption with the DEK ───────────────────────────────────────────
interface RecordEnvelope {
  iv: string; // base64
  ct: string; // base64 ciphertext + auth tag
}

/** Encrypt a record (already JSON-serialised) with the DEK. */
export async function encryptWithDEK(dekB64: string, plaintext: string): Promise<string> {
  const key = await importDEK(dekB64);
  const ivBuf = crypto.getRandomValues(new Uint8Array(12));
  const iv = ivBuf.buffer as ArrayBuffer;
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const env: RecordEnvelope = { iv: toBase64(ivBuf), ct: toBase64(new Uint8Array(ct)) };
  return JSON.stringify(env);
}

/** Decrypt a DEK-encrypted record back to its plaintext string. */
export async function decryptWithDEK(dekB64: string, envelopeStr: string): Promise<string> {
  const env = JSON.parse(envelopeStr) as RecordEnvelope;
  const key = await importDEK(dekB64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(env.iv) }, key, fromBase64(env.ct));
  return new TextDecoder().decode(plain);
}

// ── Verifier: confirm a candidate DEK is correct without touching real data ──
export function makeVerifier(dekB64: string): Promise<string> {
  return encryptWithDEK(dekB64, VERIFIER_PLAINTEXT);
}

export async function checkVerifier(dekB64: string, verifier: string): Promise<boolean> {
  try {
    return (await decryptWithDEK(dekB64, verifier)) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

// ── Session DEK (memory only; cleared on lock / tab close) ────────────────────
let sessionDEK: string | null = null;

export function setSessionDEK(dekB64: string | null): void {
  sessionDEK = dekB64;
}

export function getSessionDEK(): string | null {
  return sessionDEK;
}

export function lockSession(): void {
  sessionDEK = null;
}

// ── Recovery code ─────────────────────────────────────────────────────────────
// Crockford-style alphabet (no I, L, O, 0, 1) to avoid transcription ambiguity.
const RC_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RC_GROUPS = 5;
const RC_PER_GROUP = 5;

/** Generate a high-entropy recovery code, e.g. "A7K2M-..." (5 groups of 5). */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RC_GROUPS * RC_PER_GROUP));
  const groups: string[] = [];
  for (let g = 0; g < RC_GROUPS; g++) {
    let s = '';
    for (let i = 0; i < RC_PER_GROUP; i++) {
      s += RC_ALPHABET[bytes[g * RC_PER_GROUP + i] % RC_ALPHABET.length];
    }
    groups.push(s);
  }
  return groups.join('-');
}

/** Normalise a user-entered recovery code (strip separators, upper-case) for matching. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
