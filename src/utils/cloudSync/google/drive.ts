// Google Drive REST helpers — all operations scoped to appDataFolder.
// appDataFolder is hidden from the user's Drive UI, uses only `drive.appdata` scope.

import { CloudBackupFile } from '../types';
import { getToken, signIn, signOut, isSignedIn, getEmail } from './gis';
import type { CloudProvider } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const MAX_BACKUPS = 30;

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
  upload: async (json, filename) => {
    const file = await uploadBackup(json, filename);
    await pruneOldBackups().catch(() => {});
    return file;
  },
  list: listBackups,
  download: downloadBackup,
  delete: deleteBackup,
};
