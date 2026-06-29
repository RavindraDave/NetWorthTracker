// Google Drive REST helpers — all operations scoped to appDataFolder.
// appDataFolder is hidden from the user's Drive UI, uses only `drive.appdata` scope.

import { CloudBackupFile } from '../types';
import { getToken, signIn, signOut, isSignedIn, getEmail, getName, getPicture } from './gis';
import type { CloudProvider } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const MAX_BACKUPS = 90;
const CANONICAL_FILENAME = 'wealthpulse-sync.json';

async function authedFetch(url: string, options: RequestInit, retry = true): Promise<Response> {
  const token = await getToken();
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (res.status === 401 && retry) {
    // Force re-auth then retry once
    await signIn();
    return authedFetch(url, options, false);
  }
  return res;
}

export async function listBackups(): Promise<CloudBackupFile[]> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    orderBy: 'modifiedTime desc',
    pageSize: '50',
    fields: 'files(id,name,size,modifiedTime)',
  });
  const res = await authedFetch(`${DRIVE_API}/files?${params}`, { method: 'GET' });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const json = await res.json() as { files: Array<{ id: string; name: string; size?: string; modifiedTime: string }> };
  return (json.files ?? []).map(f => ({
    id: f.id,
    name: f.name,
    size: f.size ? parseInt(f.size, 10) : undefined,
    modifiedTime: f.modifiedTime,
  }));
}

export async function uploadBackup(json: string, filename: string): Promise<CloudBackupFile> {
  const metadata = JSON.stringify({ name: filename, parents: ['appDataFolder'] });
  const body = new FormData();
  body.append('metadata', new Blob([metadata], { type: 'application/json' }));
  body.append('file', new Blob([json], { type: 'application/json' }));

  const res = await authedFetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,size,modifiedTime`, {
    method: 'POST',
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  const f = await res.json() as { id: string; name: string; size?: string; modifiedTime: string };
  return { id: f.id, name: f.name, size: f.size ? parseInt(f.size, 10) : undefined, modifiedTime: f.modifiedTime };
}

export async function downloadBackup(fileId: string): Promise<string> {
  const res = await authedFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { method: 'GET' });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.text();
}

export async function deleteBackup(fileId: string): Promise<void> {
  const res = await authedFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Drive delete failed: ${res.status}`);
}

async function pruneOldBackups(): Promise<void> {
  const files = await listBackups();
  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    await Promise.all(toDelete.map(f => deleteBackup(f.id)));
  }
}

// ── Canonical sync file ───────────────────────────────────────────────────────
// wealthpulse-sync.json: a single file updated in place on every sync.
// This provides a stable "latest state" for two-way sync / merge.
//
// Optimistic concurrency: Drive returns a monotonic `version` per file. We capture
// it on read and refuse to overwrite if the remote has advanced past the version the
// caller last reconciled against — preventing a second device from silently
// clobbering a write it never saw.

export interface CanonicalMeta {
  id: string;
  version?: number;
}

/** Thrown by writeCanonicalFile when the remote file advanced past the expected version. */
export class CanonicalConflictError extends Error {
  constructor(public currentVersion?: number) {
    super('Canonical sync file changed on the server since the last pull.');
    this.name = 'CanonicalConflictError';
  }
}

function parseVersion(v?: string): number | undefined {
  return v ? parseInt(v, 10) : undefined;
}

export async function findCanonicalFile(): Promise<CanonicalMeta | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${CANONICAL_FILENAME}'`,
    fields: 'files(id,version)',
    pageSize: '1',
  });
  const res = await authedFetch(`${DRIVE_API}/files?${params}`, { method: 'GET' });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const json = await res.json() as { files: Array<{ id: string; version?: string }> };
  const f = json.files?.[0];
  return f ? { id: f.id, version: parseVersion(f.version) } : null;
}

async function createCanonicalFile(payload: string): Promise<CanonicalMeta> {
  const metadata = JSON.stringify({ name: CANONICAL_FILENAME, parents: ['appDataFolder'] });
  const body = new FormData();
  body.append('metadata', new Blob([metadata], { type: 'application/json' }));
  body.append('file', new Blob([payload], { type: 'application/json' }));
  const res = await authedFetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,version`,
    { method: 'POST', body },
  );
  if (!res.ok) throw new Error(`Drive create sync file failed: ${res.status}`);
  const f = await res.json() as { id: string; version?: string };
  return { id: f.id, version: parseVersion(f.version) };
}

async function updateCanonicalFile(fileId: string, payload: string): Promise<number | undefined> {
  const res = await authedFetch(
    `${DRIVE_UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=version`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload },
  );
  if (!res.ok) throw new Error(`Drive update sync file failed: ${res.status}`);
  const f = await res.json() as { version?: string };
  return parseVersion(f.version);
}

/**
 * Write (create or update) the canonical sync file; returns the new file metadata.
 * When `expectedVersion` is supplied and the remote has advanced beyond it, throws
 * CanonicalConflictError instead of overwriting.
 */
export async function writeCanonicalFile(payload: string, expectedVersion?: number): Promise<CanonicalMeta> {
  const existing = await findCanonicalFile();
  if (existing) {
    if (
      expectedVersion !== undefined &&
      existing.version !== undefined &&
      existing.version > expectedVersion
    ) {
      throw new CanonicalConflictError(existing.version);
    }
    const version = await updateCanonicalFile(existing.id, payload);
    return { id: existing.id, version };
  }
  return createCanonicalFile(payload);
}

/** Download the canonical sync file content, or null if it doesn't exist. */
export async function readCanonicalFile(): Promise<string | null> {
  const meta = await findCanonicalFile();
  if (!meta) return null;
  return downloadBackup(meta.id);
}

/** Download the canonical sync file content along with its Drive version, or null. */
export async function readCanonicalFileWithMeta(): Promise<{ content: string; version?: number } | null> {
  const meta = await findCanonicalFile();
  if (!meta) return null;
  const content = await downloadBackup(meta.id);
  return { content, version: meta.version };
}

// CloudProvider implementation for Google Drive
export const googleDriveProvider: CloudProvider = {
  id: 'google',
  name: 'Google Drive',
  signIn: async () => {
    const { accessToken, expiresAt } = await signIn();
    return { accessToken, expiresAt };
  },
  signOut,
  isSignedIn,
  getEmail,
  getName,
  getPicture,
  upload: async (json, filename) => {
    const file = await uploadBackup(json, filename);
    await pruneOldBackups().catch(() => {});
    return file;
  },
  list: listBackups,
  download: downloadBackup,
  delete: deleteBackup,
};
