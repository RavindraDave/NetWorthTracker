import React, { useState, useMemo } from 'react';
import { Tag } from '../../types';
import { normalizeTagName } from '../../utils/tags';

interface TagPickerPanelProps {
  tags: Tag[];
  selectedIds: string[];
  onToggle: (tagId: string) => void;
  onCreate: (name: string) => void;
}

/**
 * Multi-select checkbox list for cross-category tags, plus an inline
 * "create new" input — mirrors the sub-category picker's find-or-create
 * pattern, but as checkboxes rather than a single-select, since an item can
 * carry several tags at once.
 */
export const TagPickerPanel: React.FC<TagPickerPanelProps> = ({ tags, selectedIds, onToggle, onCreate }) => {
  const [newName, setNewName] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const willReuse = useMemo(() => {
    const key = normalizeTagName(newName);
    if (!key) return undefined;
    return tags.find(t => normalizeTagName(t.name) === key)?.name;
  }, [newName, tags]);

  const commit = () => {
    const trimmed = newName.trim();
    if (trimmed) onCreate(trimmed);
    setNewName('');
  };

  return (
    <div className="cost-basis-config tag-picker-panel">
      {tags.length > 0 && (
        <div className="tag-picker-list">
          {tags.map(t => (
            <label key={t.id} className="tag-picker-item">
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => onToggle(t.id)}
                aria-label={`Tag: ${t.name}`}
              />
              <span>{t.name}</span>
            </label>
          ))}
        </div>
      )}
      <div className="loan-field">
        <label className="loan-label">New tag</label>
        <input
          type="text"
          className="line-item-input loan-input"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') setNewName('');
          }}
          placeholder="e.g. Retirement accounts"
          aria-label="New tag name"
        />
        {willReuse && <span className="line-item-subcat__hint">Using existing “{willReuse}”</span>}
      </div>
      <p className="tag-picker-note">
        Tags are a reporting lens across categories — they never affect net worth.
        An item with several tags counts fully under each one.
      </p>
    </div>
  );
};
