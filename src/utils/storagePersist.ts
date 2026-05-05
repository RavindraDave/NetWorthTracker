export const isPersistApiSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'storage' in navigator && 'persist' in navigator.storage;

export const isPersisted = (): Promise<boolean> =>
  isPersistApiSupported() ? navigator.storage.persisted() : Promise.resolve(false);

export const requestPersist = (): Promise<boolean> =>
  isPersistApiSupported() ? navigator.storage.persist() : Promise.resolve(false);

export const estimateStorage = async (): Promise<{ usage: number; quota: number; pct: number }> => {
  if (!isPersistApiSupported() || !('estimate' in navigator.storage)) {
    return { usage: 0, quota: 0, pct: 0 };
  }
  const est = await navigator.storage.estimate();
  const usage = est.usage ?? 0;
  const quota = est.quota ?? 0;
  return { usage, quota, pct: quota > 0 ? (usage / quota) * 100 : 0 };
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
