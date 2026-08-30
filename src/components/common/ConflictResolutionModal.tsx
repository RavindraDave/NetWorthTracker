import React, { useState } from 'react';
import { GitMerge, X } from 'lucide-react';
import { Modal } from './Modal';
import { SyncConflict } from '../../utils/cloudSync/syncEngine';
import { Snapshot, Goal } from '../../types';

interface Props {
  conflicts: SyncConflict[];
  onResolve: (resolutions: Map<string, 'local' | 'remote'>) => void;
  onDismiss: () => void;
}

function formatUpdated(item: Snapshot | Goal): string {
  const t = (item as Goal).updatedAt ?? item.createdAt;
  if (!t) return '';
  return new Date(t).toLocaleString();
}

/** Short "what's different" cue — item count for snapshots, target amount for goals. */
function summarize(item: Snapshot | Goal, kind: SyncConflict['kind']): string {
  if (kind === 'snapshot') {
    const s = item as Snapshot;
    const itemCount = s.categories.reduce((n, c) => n + c.items.length, 0);
    return `${itemCount} item${itemCount === 1 ? '' : 's'}`;
  }
  const g = item as Goal;
  return g.targetAmount ? g.targetAmount.toLocaleString() : g.type;
}

export const ConflictResolutionModal: React.FC<Props> = ({ conflicts, onResolve, onDismiss }) => {
  const [choices, setChoices] = useState<Map<string, 'local' | 'remote'>>(() =>
    new Map(conflicts.map(c => [c.id, 'local']))
  );

  const setChoice = (key: string, val: 'local' | 'remote') =>
    setChoices(prev => new Map(prev).set(key, val));

  const handleResolve = () => onResolve(choices);

  const cellStyle: React.CSSProperties = {
    padding: '0.5rem 0.6rem',
    fontSize: '0.8rem',
    verticalAlign: 'top',
    borderBottom: '1px solid var(--border-subtle)',
  };

  return (
    <Modal
      onClose={onDismiss}
      aria-label="Resolve sync conflicts"
      contentStyle={{ maxWidth: 680, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GitMerge size={16} style={{ color: 'var(--accent-text)' }} />
            Sync Conflicts ({conflicts.length})
          </h3>
          <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>
            Both devices changed these items. Choose which version to keep.
          </p>
        </div>
        <button className="btn-icon" onClick={onDismiss} aria-label="Close"><X size={16} /></button>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.1)' }}>
              <th style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-3)', textAlign: 'left' }}>Item</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-3)', textAlign: 'center', minWidth: 110 }}>Keep mine</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-3)', textAlign: 'center', minWidth: 110 }}>Keep theirs</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map(c => {
              const choice = choices.get(c.id) ?? 'local';
              const localUpdated  = formatUpdated(c.local);
              const remoteUpdated = formatUpdated(c.remote);
              return (
                <tr key={c.id}>
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>
                      {c.kind === 'snapshot' ? `Snapshot ${c.label}` : c.label}
                    </span>
                    <span style={{ display: 'block', color: 'var(--text-3)', fontSize: '0.72rem', marginTop: 2 }}>
                      {c.kind === 'snapshot'
                        ? `${(c.local as Snapshot).categories.length} categories`
                        : `Goal — ${(c.local as Goal).type}`}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name={`conflict-${c.id}`}
                        checked={choice === 'local'}
                        onChange={() => setChoice(c.id, 'local')}
                        aria-label={`Keep local version of ${c.label}`}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{summarize(c.local, c.kind)}</span>
                      {localUpdated && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{localUpdated}</span>
                      )}
                    </label>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name={`conflict-${c.id}`}
                        checked={choice === 'remote'}
                        onChange={() => setChoice(c.id, 'remote')}
                        aria-label={`Keep remote version of ${c.label}`}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{summarize(c.remote, c.kind)}</span>
                      {remoteUpdated && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{remoteUpdated}</span>
                      )}
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => {
            const all = new Map(conflicts.map(c => [c.id, 'local' as const]));
            setChoices(all);
          }}>
            Keep all mine
          </button>
          <button className="btn btn-outline" onClick={() => {
            const all = new Map(conflicts.map(c => [c.id, 'remote' as const]));
            setChoices(all);
          }}>
            Keep all theirs
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={onDismiss}>Cancel (keep local)</button>
          <button className="btn btn-primary" onClick={handleResolve}>Apply resolutions</button>
        </div>
      </div>
    </Modal>
  );
};
