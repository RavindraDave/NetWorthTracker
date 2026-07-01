// Optional passkey unlock via WebAuthn + the PRF extension.
//
// A platform authenticator (Touch ID / Windows Hello / a security key) holds a private
// key in hardware. The PRF extension lets us derive a stable high-entropy secret from it,
// which we use to wrap the DEK (see keyVault.wrapDEK). This binds unlock to the OS user —
// the strongest defence for the shared-PC threat — while keeping a passphrase fallback.
//
// PRF support is uneven across browsers/authenticators, so every entry point is
// feature-detected and the passphrase always remains available.

const RP_NAME = 'WealthPulse';
const PRF_SALT = new TextEncoder().encode('wealthpulse-applock-prf-v1');

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToBuf(s: string): ArrayBuffer {
  const binary = atob(s);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

/** True if this browser exposes the WebAuthn APIs at all. */
export function isWebAuthnAvailable(): boolean {
  return typeof window !== 'undefined'
    && typeof window.PublicKeyCredential !== 'undefined'
    && !!navigator.credentials;
}

/** Best-effort check for a usable platform authenticator (e.g. Touch ID / Hello). */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export interface PasskeyRegistration {
  credentialId: string; // base64
  prfSecret: string;    // base64 — the wrapping secret for the DEK
}

interface PrfExtensionResults {
  prf?: { results?: { first?: ArrayBuffer } };
}

/** Register a new passkey and derive its PRF secret. Throws if PRF is unsupported. */
export async function registerPasskey(): Promise<PasskeyRegistration> {
  if (!isWebAuthnAvailable()) throw new Error('Passkeys are not supported in this browser.');
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: location.hostname },
      user: { id: userId, name: 'wealthpulse', displayName: 'WealthPulse' },
      challenge,
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('Passkey registration was cancelled.');
  const credentialId = bufToB64(cred.rawId);
  // Many authenticators only return PRF output on an assertion, so derive via get().
  const prfSecret = await derivePrfSecret(credentialId);
  return { credentialId, prfSecret };
}

/** Derive the PRF secret for an existing credential (used for both setup and unlock). */
export async function derivePrfSecret(credentialId: string): Promise<string> {
  if (!isWebAuthnAvailable()) throw new Error('Passkeys are not supported in this browser.');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: b64ToBuf(credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null;
  if (!assertion) throw new Error('Passkey unlock was cancelled.');
  const results = (assertion.getClientExtensionResults() as PrfExtensionResults).prf?.results?.first;
  if (!results) throw new Error('This device or browser does not support passkey-derived encryption (PRF).');
  return bufToB64(results);
}
