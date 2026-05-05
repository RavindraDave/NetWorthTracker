// Google Identity Services (GIS) OAuth token client wrapper.
// Tokens are stored in sessionStorage so they survive navigation but not
// a browser-data clear — which is exactly the scenario we're recovering from.
//
// Client ID resolution order:
//   1. VITE_GOOGLE_CLIENT_ID build-time env var (set by the app host in Vercel)
//   2. Runtime ID stored via configureClientId() (entered by self-hosters in Settings)

const SESSION_KEY = 'gis_token';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

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
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
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

async function fetchEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return '';
    const json = await res.json() as { email?: string };
    return json.email ?? '';
  } catch {
    return '';
  }
}

export async function signIn(): Promise<{ accessToken: string; expiresAt: number; email: string }> {
  const clientId = resolveClientId();
  if (!clientId) {
    throw new Error('Google Client ID not configured. Enter it in Settings → Cloud Sync, or ask the app host to configure VITE_GOOGLE_CLIENT_ID.');
  }

  // Return cached valid token
  const cached = loadToken();
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return { accessToken: cached.accessToken, expiresAt: cached.expiresAt, email: cached.email };
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
        const email = await fetchEmail(resp.access_token);
        const record: TokenRecord = { accessToken: resp.access_token, expiresAt, email };
        saveToken(record);
        resolve(record);
      },
      error_callback: (err) => reject(new Error(err.type)),
    });
    // prompt: '' = use consent already granted; no popup if token is still valid server-side.
    client.requestAccessToken({ prompt: '' });
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

/** Returns a valid access token, re-authing silently if needed. */
export async function getToken(): Promise<string> {
  const { accessToken } = await signIn();
  return accessToken;
}
