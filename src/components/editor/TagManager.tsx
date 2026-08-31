import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Snapshot } from '../../types';
import { renameTag, deleteTag } from '../../utils/tags';
import { useToast } from '../common/Toast';
import { X, Trash2, Check, Pencil } from 'lucide-react';
import './TagManager.css';

interface TagManagerProps {
  snapshot: Snapshot;
  onChange: (updated: Snapshot) => void;
  onClose: () => void;
}

/**
 * Rename/delete for this snapshot's tag registry. There is no cross-month
 * "global" tag list to manage — tags are scoped per snapshot by design (see
 * `Tag` in `types/index.ts`) — so this operates on the snapshot being edited,
 * not on app-wide settings.
 */
export const TagManager: React.FC<TagManagerProps> = ({ snapshot, onChange, onClose }) => {
  const { confirm } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const tags = snapshot.tags ?? [];

  const startEdit = (id: string, name: string) => { setEditingId(id); setDraftName(name); };

  const commitEdit = () => {
    if (!editingId) return;
    const { snapshot: next, collidesWith } = renameTag(snapshot, editingId, draftName);
    if (!collidesWith) onChange(next);
    // A collision is left as a no-op rather than auto-merging — unlike sub-categories,
    // merging two tags would silently double up on the shared items' allocation counts.
    setEditingId(null);
    setDraftName('');
  };

  const handleDelete = async (id: string, name: string) => {
    const count = snapshot.categories.reduce(
      (sum, c) => sum + c.items.filter(i => i.tagIds?.includes(id)).length, 0,
    );
    const ok = await confirm(
      count > 0
        ? `Delete “${name}”? It's applied to ${count} item${count === 1 ? '' : 's'} this month — they stay, just untagged.`
        : `Delete “${name}”?`,
      'destructive',
    );
    if (ok) onChange(deleteTag(snapshot, id));
  };

  return (
    <Modal onClose={onClose} aria-label="Manage tags" contentStyle={{ maxWidth: 420, width: '95vw' }}>
      <div className="tagmgr-head">
        <div>
          <h3 className="tagmgr-title">Tags — {snapshot.month}</h3>
          <span className="tagmgr-sub">Cross-category labels for reporting. Scoped to this month.</span>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>

      {tags.length === 0 ? (
        <p className="tagmgr-empty">No tags yet — create one from any line item's tag panel.</p>
      ) : (
        <ul className="tagmgr-list">
          {tags.map(t => (
            <li key={t.id} className="tagmgr-row">
              {editingId === t.id ? (
                <input
                  autoFocus
                  type="text"
                  className="tagmgr-input"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit();
                    else if (e.key === 'Escape') setEditingId(null);
                  }}
                  aria-label={`Rename ${t.name}`}
                />
              ) : (
                <span className="tagmgr-name">{t.name}</span>
              )}
              <div className="tagmgr-actions">
                {editingId === t.id ? (
                  <button className="btn-icon" onClick={commitEdit} aria-label="Save name"><Check size={14} /></button>
                ) : (
                  <button className="btn-icon" onClick={() => startEdit(t.id, t.name)} aria-label={`Rename ${t.name}`}><Pencil size={14} /></button>
                )}
                <button className="btn-icon danger" onClick={() => handleDelete(t.id, t.name)} aria-label={`Delete ${t.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};
