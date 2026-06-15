// AES-GCM-256 encryption for Drive backups via window.crypto.subtle — zero deps.
// Passphrase is held in session memory only; lost on tab close.

interface EncryptionEnvelope {
  v: 1;
  kdf: 'PBKDF2';
  iter: number;
  salt: string; // base64
  iv: string;   // base64
  ct: string;   // base64 ciphertext + auth tag
}

let sessionPassphrase: string | null = null;

export function setPassphrase(p: string | null): void {
  sessionPassphrase = p;
}

export function getPassphrase(): string | null {
  return sessionPassphrase;
}

export function hasPassphrase(): boolean {
  return sessionPassphrase !== null && sessionPassphrase.length > 0;
}

function toBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

function fromBase64(s: string): ArrayBuffer {
  if (!/^[A-Za-z0-9+/]*=*$/.test(s) || s.length % 4 !== 0) {
    throw new Error('Invalid encrypted backup format.');
  }
  let binary: string;
  try {
    binary = atob(s);
  } catch {
    throw new Error('Invalid encrypted backup format.');
  }
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

const PBKDF2_ITERATIONS = 100_000;

async function deriveKey(passphrase: string, salt: ArrayBuffer, iterations: number): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJSON(plaintext: string, passphrase: string): Promise<string> {
  const saltBuf = crypto.getRandomValues(new Uint8Array(16));
  const ivBuf   = crypto.getRandomValues(new Uint8Array(12));
  const salt    = saltBuf.buffer as ArrayBuffer;
  const iv      = ivBuf.buffer as ArrayBuffer;
  const key     = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ct      = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const envelope: EncryptionEnvelope = {
    v: 1, kdf: 'PBKDF2', iter: PBKDF2_ITERATIONS,
    salt: toBase64(saltBuf),
    iv:   toBase64(ivBuf),
    ct:   toBase64(new Uint8Array(ct)),
  };
  return JSON.stringify(envelope);
}

export async function decryptJSON(envelopeStr: string, passphrase: string): Promise<string> {
  let envelope: EncryptionEnvelope;
  try {
    envelope = JSON.parse(envelopeStr) as EncryptionEnvelope;
  } catch {
    throw new Error('Invalid encrypted backup format.');
  }
  if (envelope.v !== 1 || envelope.kdf !== 'PBKDF2') {
    throw new Error('Unsupported encryption envelope version.');
  }
  const salt = fromBase64(envelope.salt);
  const iv   = fromBase64(envelope.iv);
  const ct   = fromBase64(envelope.ct);
  const iterations = typeof envelope.iter === 'number' && envelope.iter > 0 ? envelope.iter : PBKDF2_ITERATIONS;
  const key  = await deriveKey(passphrase, salt, iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupted backup.');
  }
  return new TextDecoder().decode(plain);
}

export function isEncryptedEnvelope(text: string): boolean {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    return obj.v === 1 && obj.kdf === 'PBKDF2' && typeof obj.ct === 'string';
  } catch {
    return false;
  }
}
