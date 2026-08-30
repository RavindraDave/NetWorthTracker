import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Pencil, MoreHorizontal, ArrowUp, ArrowDown, Trash2, Merge } from 'lucide-react';
import { SubCategory } from '../../types';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { InfoTooltip } from '../common/InfoTooltip';
import './SubCategoryGroupHeader.css';

interface SubCategoryGroupHeaderProps {
  /** null = the ungrouped bucket, which has no name and no actions. */
  id: string | null;
  name: string;
  itemCount: number;
  total: number;
  baseCurrency: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Sibling groups, for the "Merge into…" menu. Excludes this one. */
  siblings: SubCategory[];
  isFirst: boolean;
  isLast: boolean;
  description?: string;
  /** Name and description are saved together — see updateSubCategory. */
  onEdit: (patch: { name: string; description: string }) => void;
  onMove: (delta: -1 | 1) => void;
  onMerge: (intoId: string) => void;
  onDelete: () => void;
}

export const SubCategoryGroupHeader: React.FC<SubCategoryGroupHeaderProps> = ({
  id, name, description, itemCount, total, baseCurrency, collapsed, onToggleCollapse,
  siblings, isFirst, isLast, onEdit, onMove, onMerge, onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [descDraft, setDescDraft] = useState(description ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isUngrouped = id === null;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Close the menu on any outside click — a row-level popover that survives a click
  // elsewhere feels stuck, and there can be one of these per group.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const startEdit = () => {
    setDraft(name);
    setDescDraft(description ?? '');
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const trimmedName = draft.trim();
    const trimmedDesc = descDraft.trim();
    if (!trimmedName) return;
    if (trimmedName === name && trimmedDesc === (description ?? '')) return;
    onEdit({ name: trimmedName, description: trimmedDesc });
  };

  // Blur fires when moving between the two fields, which must not commit-and-close
  // mid-edit. Only a blur that leaves the editor entirely counts.
  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    if (e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) return;
    commitEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') {
      setDraft(name);
      setDescDraft(description ?? '');
      setEditing(false);
    }
  };

  return (
    <div className={`subcat-header${isUngrouped ? ' subcat-header--ungrouped' : ''}`}>
      <button
        type="button"
        className="subcat-header__toggle"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${name || 'Ungrouped'}` : `Collapse ${name || 'Ungrouped'}`}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>

      {editing ? (
        <span className="subcat-header__edit">
          <input
            ref={inputRef}
            className="subcat-header__input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            aria-label={`Rename ${name}`}
          />
          <input
            className="subcat-header__input subcat-header__input--desc"
            value={descDraft}
            onChange={e => setDescDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="What belongs in this group? (optional)"
            aria-label={`Description for ${name}`}
          />
        </span>
      ) : (
        <span className={`subcat-header__name${isUngrouped ? ' subcat-header__name--muted' : ''}`}>
          {isUngrouped ? 'Ungrouped' : name}
        </span>
      )}

      {!isUngrouped && !editing && description && <InfoTooltip body={description} />}

      <span className="subcat-header__count">
        {itemCount} {itemCount === 1 ? 'item' : 'items'}
      </span>

      <span className="subcat-header__total">
        <CurrencyDisplay amount={total} currency={baseCurrency} />
      </span>

      {!isUngrouped && !editing && (
        <div className="subcat-header__actions">
          <button
            type="button"
            className="btn-icon subcat-header__action"
            onClick={startEdit}
            title="Rename group"
            aria-label={`Rename group ${name}`}
          >
            <Pencil size={13} />
          </button>

          <div className="subcat-header__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="btn-icon subcat-header__action"
              onClick={() => setMenuOpen(o => !o)}
              title="Group options"
              aria-label={`Options for group ${name}`}
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={13} />
            </button>

            {menuOpen && (
              <div className="subcat-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="subcat-menu__item"
                  disabled={isFirst}
                  onClick={() => { onMove(-1); setMenuOpen(false); }}
                >
                  <ArrowUp size={13} /> Move up
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="subcat-menu__item"
                  disabled={isLast}
                  onClick={() => { onMove(1); setMenuOpen(false); }}
                >
                  <ArrowDown size={13} /> Move down
                </button>

                {siblings.length > 0 && (
                  <>
                    <div className="subcat-menu__label">
                      <Merge size={12} /> Merge into
                    </div>
                    {siblings.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        role="menuitem"
                        className="subcat-menu__item subcat-menu__item--indent"
                        onClick={() => { onMerge(s.id); setMenuOpen(false); }}
                      >
                        {s.name}
                      </button>
                    ))}
                  </>
                )}

                <button
                  type="button"
                  role="menuitem"
                  className="subcat-menu__item subcat-menu__item--danger"
                  onClick={() => { onDelete(); setMenuOpen(false); }}
                >
                  <Trash2 size={13} /> Delete group
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
