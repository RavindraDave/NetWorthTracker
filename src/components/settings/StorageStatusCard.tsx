import React, { useEffect, useState } from 'react';
import { Shield, ShieldAlert } from 'lucide-react';
import { isPersistApiSupported, isPersisted, requestPersist, estimateStorage, formatBytes } from '../../utils/storagePersist';

interface StorageState {
  persisted: boolean;
  usage: number;
  quota: number;
  pct: number;
  supported: boolean;
}

export const StorageStatusCard: React.FC = () => {
  const [state, setState] = useState<StorageState | null>(null);
  const [requesting, setRequesting] = useState(false);

  const refresh = async () => {
    const supported = isPersistApiSupported();
    const [persisted, estimate] = await Promise.all([
      isPersisted(),
      estimateStorage(),
    ]);
    setState({ persisted, supported, ...estimate });
  };

  useEffect(() => { refresh(); }, []);

  const handleRequest = async () => {
    setRequesting(true);
    await requestPersist();
    await refresh();
    setRequesting(false);
  };

  if (!state) return null;

  return (
    <div className="data-action-card" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
      <div className="data-action-card__info">
        <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {state.persisted
            ? <Shield size={18} style={{ color: 'var(--accent-green)' }} />
            : <ShieldAlert size={18} style={{ color: 'var(--accent-yellow, #f59e0b)' }} />
          }
          Local Storage
        </h3>

        {state.supported ? (
          <>
            <p className="text-muted text-sm" style={{ marginBottom: '0.25rem' }}>
              {state.persisted
                ? 'Protected — browser won\'t automatically evict your data.'
                : 'Not protected — browser may clear data under storage pressure. Install as a PWA or click "Request Protection" to fix this.'}
            </p>
            {state.quota > 0 && (
              <p className="text-muted text-sm">
                Using {formatBytes(state.usage)} of {formatBytes(state.quota)} ({state.pct.toFixed(1)}%)
              </p>
            )}
          </>
        ) : (
          <p className="text-muted text-sm">Storage Persistence API not available in this browser.</p>
        )}
      </div>

      {state.supported && !state.persisted && (
        <button className="btn btn-outline" onClick={handleRequest} disabled={requesting}>
          {requesting ? 'Requesting…' : 'Request Protection'}
        </button>
      )}
    </div>
  );
};
