// Google Identity Services (GIS) OAuth token client wrapper.
// Tokens are stored in sessionStorage so they survive navigation but not
// a browser-data clear — which is exactly the scenario we're recovering from.
//
// Client ID resolution order:
//   1. VITE_GOOGLE_CLIENT_ID build-time env var (set by the app host in Vercel)
//   2. Runtime ID stored via configureClientId() (entered by self-hosters in Settings)

const SESSION_KEY = 'gis_token';

// drive.appdata  — hidden per-app Drive folder
// profile        — user's name and profile photo
// email          — user's email address
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata profile email';

// Set by AppContext when preferences load a user-saved client ID.
let _runtimeClientId = '';

export function configureClientId(id: string): void {
  _runtimeClientId = id.trim();
}

export function resolveClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '') || _runtimeClientId;
}

export function isClientIdConfigured(): boolean {
  return resolveClientId().length > 0;
}

interface TokenRecord {
  accessToken: string;
  expiresAt: number;
  email: string;
  name: string;
  picture: string;
}

// Declared by the GIS script; loaded lazily via injectGisScript().
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string; expires_in?: number }) => void;
            error_callback?: (err: { type: string }) => void;
          }): {
            requestAccessToken(opts?: { prompt?: string }): void;
          };
          revoke(token: string, done: () => void): void;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;

function injectGisScript(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null; // allow retry on next attempt
      reject(new Error(
        'Could not load Google Sign-In. Check that accounts.google.com is reachable and not blocked by a browser extension or firewall.'
      ));
    };
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

function loadToken(): TokenRecord | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TokenRecord;
  } catch {
    return null;
  }
}

function saveToken(rec: TokenRecord): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(rec));
}

function clearToken(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

interface UserProfile {
  email: string;
  name: string;
  picture: string;
}

async function fetchProfile(accessToken: string): Promise<UserProfile> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { email: '', name: '', picture: '' };
    const json = await res.json() as { email?: string; name?: string; picture?: string };
    return {
      email:   json.email   ?? '',
      name:    json.name    ?? '',
      picture: json.picture ?? '',
    };
  } catch {
    return { email: '', name: '', picture: '' };
  }
}

// Maps GIS error_callback `type` codes to user-friendly messages.
const GIS_ERROR_MESSAGES: Record<string, string> = {
  popup_closed: 'Sign-in window was closed before completing. Please try again and keep the window open until it finishes.',
  popup_failed_to_open: 'Sign-in popup was blocked. Please allow popups for this site and try again.',
};

function describeGisError(type: string): string {
  return GIS_ERROR_MESSAGES[type] ?? `Google sign-in failed (${type}). Please try again.`;
}

export async function signIn(opts?: { prompt?: string }): Promise<{ accessToken: string; expiresAt: number; email: string; name: string; picture: string }> {
  const clientId = resolveClientId();
  if (!clientId) {
    throw new Error('Google Client ID not configured. Enter it in Settings → Cloud Sync, or ask the app host to configure VITE_GOOGLE_CLIENT_ID.');
  }

  // Forcing a prompt (e.g. 'consent' for the key-recovery path) must never silently reuse
  // a cached token — that's what prevents a live Google session on a shared PC from
  // bypassing the lock during recovery.
  const forcePrompt = !!opts?.prompt;

  // Return cached valid token
  const cached = loadToken();
  if (!forcePrompt && cached && cached.expiresAt > Date.now() + 60_000) {
    return { accessToken: cached.accessToken, expiresAt: cached.expiresAt, email: cached.email, name: cached.name, picture: cached.picture };
  }

  await injectGisScript();

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'GIS sign-in failed'));
          return;
        }
        const expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000;
        const profile = await fetchProfile(resp.access_token);
        const record: TokenRecord = { accessToken: resp.access_token, expiresAt, ...profile };
        saveToken(record);
        resolve(record);
      },
      error_callback: (err) => reject(new Error(describeGisError(err.type))),
    });
    // prompt: '' = use consent already granted; no popup if token is still valid server-side.
    // A caller-supplied prompt (e.g. 'consent') forces re-authentication.
    client.requestAccessToken({ prompt: opts?.prompt ?? '' });
  });
}

export async function signOut(): Promise<void> {
  const cached = loadToken();
  if (cached) {
    await new Promise<void>(resolve => window.google?.accounts.oauth2.revoke(cached.accessToken, resolve));
    clearToken();
  }
}

export function isSignedIn(): boolean {
  const cached = loadToken();
  return !!cached && cached.expiresAt > Date.now() + 30_000;
}

export function getEmail(): string | null {
  return loadToken()?.email ?? null;
}

export function getName(): string | null {
  return loadToken()?.name || null;
}

export function getPicture(): string | null {
  return loadToken()?.picture || null;
}

/** Returns a valid access token, re-authing silently if needed. */
export async function getToken(): Promise<string> {
  const { accessToken } = await signIn();
  return accessToken;
}
