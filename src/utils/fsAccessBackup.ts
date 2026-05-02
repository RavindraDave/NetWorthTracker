import { db } from '../db/database';

const HANDLE_KEY = 'autoBackup';

export const isFsaSupported = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function pickBackupFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFsaSupported()) return null;
  try {
    const handle = await (window as Window & typeof globalThis & { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker({ mode: 'readwrite', startIn: 'documents', id: 'wealthpulse-backup' });
    await db.fileHandles.put({ id: HANDLE_KEY, handle });
    return handle;
  } catch {
    return null;
  }
}

export async function getSavedFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const record = await db.fileHandles.get(HANDLE_KEY);
    return record?.handle ?? null;
  } catch {
    return null;
  }
}

export async function clearBackupFolder(): Promise<void> {
  await db.fileHandles.delete(HANDLE_KEY);
}

export async function getFolderPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  return (handle as unknown as { queryPermission(opts: object): Promise<PermissionState> })
    .queryPermission({ mode: 'readwrite' });
}

export async function requestFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const state = await (handle as unknown as { requestPermission(opts: object): Promise<PermissionState> })
    .requestPermission({ mode: 'readwrite' });
  return state === 'granted';
}

export async function writeFsaBackup(filename: string, content: string): Promise<boolean> {
  const handle = await getSavedFolderHandle();
  if (!handle) return false;

  const permission = await getFolderPermission(handle);
  if (permission !== 'granted') {
    const granted = await requestFolderPermission(handle);
    if (!granted) return false;
  }

  try {
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
