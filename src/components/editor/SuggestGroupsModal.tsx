import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Category } from '../../types';
import { SubCategorySuggestion } from '../../utils/defaultSubCategories';
import { findSubCategoryIdByName } from '../../utils/subCategories';
import { X, Check } from 'lucide-react';
import './SuggestGroupsModal.css';

interface SuggestGroupsModalProps {
  category: Category;
  suggestions: SubCategorySuggestion[];
  onClose: () => void;
  /** Called once with every accepted suggestion — never once per group. */
  onAdd: (chosen: SubCategorySuggestion[]) => void;
}

export const SuggestGroupsModal: React.FC<SuggestGroupsModalProps> = ({
  category, suggestions, onClose, onAdd,
}) => {
  // Case-insensitive so a group the user renamed to a different casing still counts
  // as present and can't be added twice.
  const existing = useMemo(
    () => new Set(
      suggestions.filter(s => findSubCategoryIdByName(category, s.name)).map(s => s.name),
    ),
    [category, suggestions],
  );

  const available = suggestions.filter(s => !existing.has(s.name));

  /**
   * Nothing is ticked initially. Pre-ticking everything would make this behave like
   * the add-all button it replaces, and re-create the empty-group clutter it exists
   * to prevent.
   */
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (name: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const allPicked = available.length > 0 && picked.size === available.length;
  const toggleAll = () =>
    setPicked(allPicked ? new Set() : new Set(available.map(s => s.name)));

  const handleAdd = () => {
    const chosen = suggestions.filter(s => picked.has(s.name));
    if (chosen.length > 0) onAdd(chosen);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      aria-label={`Suggested sub-groups for ${category.name}`}
      contentStyle={{ maxWidth: 520, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
    >
      <div className="suggest-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="suggest-title">Suggested sub-groups</h3>
          <span className="suggest-sub">
            Pick the ones you want in {category.name}. You can rename or remove them later.
          </span>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close" style={{ flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      {available.length > 0 && (
        <button type="button" className="suggest-selectall" onClick={toggleAll}>
          {allPicked ? 'Clear all' : 'Select all'}
        </button>
      )}

      <ul className="suggest-list">
        {suggestions.map(s => {
          const already = existing.has(s.name);
          const checked = already || picked.has(s.name);
          return (
            <li key={s.name} className={`suggest-row${already ? ' suggest-row--already' : ''}`}>
              <label className="suggest-label">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={already}
                  onChange={() => toggle(s.name)}
                  aria-label={s.name}
                />
                <span className="suggest-text">
                  <span className="suggest-name">
                    {s.name}
                    {already && (
                      <span className="suggest-already"><Check size={11} /> already added</span>
                    )}
                  </span>
                  <span className="suggest-desc">{s.description}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="suggest-actions">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleAdd} disabled={picked.size === 0}>
          {picked.size === 0
            ? 'Add groups'
            : `Add ${picked.size} ${picked.size === 1 ? 'group' : 'groups'}`}
        </button>
      </div>
    </Modal>
  );
};
