import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { CategoryTemplate } from '../../types';
import { DEFAULT_CATEGORY_TEMPLATES } from '../../utils/defaultCategories';
import { InfoTooltip } from '../common/InfoTooltip';
import { HELP } from '../common/dashboardHelp';
import { useToast } from '../common/Toast';
import { Plus, Trash2, Pencil, Check, EyeOff, Eye, ShieldCheck } from 'lucide-react';
import './CategoryManager.css';

const ICONS = [
  'wallet', 'trending-up', 'piggy-bank', 'home', 'coins', 'car',
  'briefcase', 'globe', 'building', 'credit-card', 'file-text',
  'alert-circle', 'layers', 'star', 'shield', 'gift',
];

export const CategoryManager: React.FC = () => {
  const { preferences, updatePreferences, snapshots, checkCategoryIds } = useApp();
  const { success, warning } = useToast();
  const [checkingIds, setCheckingIds] = useState(false);

  const handleCheckCategoryIds = async () => {
    setCheckingIds(true);
    try {
      const result = await checkCategoryIds();
      if (result.fixed.length === 0 && result.conflicts.length === 0) {
        success('Nothing to fix — every category ID already matches.');
        return;
      }
      if (result.fixed.length > 0) {
        success(`Fixed ${result.fixed.length} category ID${result.fixed.length === 1 ? '' : 's'}: ${result.fixed.map(f => f.categoryName).join(', ')}.`);
      }
      if (result.conflicts.length > 0) {
        warning(`${result.conflicts.length} conflict${result.conflicts.length === 1 ? '' : 's'} found, left unchanged: ${result.conflicts.map(c => c.reason).join(' ')}`);
      }
    } finally {
      setCheckingIds(false);
    }
  };

  const [name, setName]           = useState('');
  const [type, setType]           = useState<'asset' | 'liability'>('asset');
  const [icon, setIcon]           = useState('layers');
  const [isLiquid, setIsLiquid]   = useState(false);
  const [isInvestable, setIsInvestable] = useState(false);

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  if (!preferences) return null;

  const templates: CategoryTemplate[] =
    preferences.categoryTemplates ?? DEFAULT_CATEGORY_TEMPLATES;

  // Count items per template across all snapshots for usage display / delete guard
  const usageMap = useMemo(() => {
    const map: Record<string, { snapshotCount: number; itemCount: number }> = {};
    for (const tmpl of templates) {
      let snapshotCount = 0;
      let itemCount = 0;
      for (const snap of snapshots) {
        const cat = snap.categories.find(
          c => c.id === tmpl.id || (c.name === tmpl.name && c.type === tmpl.type)
        );
        if (cat && cat.items.length > 0) {
          snapshotCount++;
          itemCount += cat.items.length;
        }
      }
      map[tmpl.id] = { snapshotCount, itemCount };
    }
    return map;
  }, [templates, snapshots]);

  const updateTemplate = (id: string, patch: Partial<CategoryTemplate>) => {
    const updated = templates.map(t => t.id === id ? { ...t, ...patch } : t);
    updatePreferences({ categoryTemplates: updated });
  };

  const deleteTemplate = (id: string) => {
    updatePreferences({ categoryTemplates: templates.filter(t => t.id !== id) });
  };

  const startEdit = (tmpl: CategoryTemplate) => {
    setEditingId(tmpl.id);
    setEditingName(tmpl.name);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (trimmed) updateTemplate(editingId, { name: trimmed });
    setEditingId(null);
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newTmpl: CategoryTemplate = {
      id: crypto.randomUUID(),
      name: trimmed,
      type,
      icon,
      isLiquid,
      isInvestable,
      isBuiltIn: false,
    };
    updatePreferences({ categoryTemplates: [...templates, newTmpl] });
    setName('');
    setIsLiquid(false);
    setIsInvestable(false);
  };

  const assets      = templates.filter(t => t.type === 'asset');
  const liabilities = templates.filter(t => t.type === 'liability');

  const renderRow = (tmpl: CategoryTemplate) => {
    const usage = usageMap[tmpl.id];
    const hasItems = (usage?.itemCount ?? 0) > 0;
    const isEditing = editingId === tmpl.id;

    return (
      <div key={tmpl.id} className={`cat-manager__item ${tmpl.disabled ? 'cat-manager__item--disabled' : ''}`}>
        <span className="cat-manager__badge" data-type={tmpl.type}>{tmpl.type}</span>

        {isEditing ? (
          <input
            ref={editInputRef}
            className="cat-manager__rename-input"
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') setEditingId(null);
            }}
          />
        ) : (
          <span className="cat-manager__name">{tmpl.name}</span>
        )}

        <span className="cat-manager__flags">
          <button
            className={`cat-flag-btn ${tmpl.isLiquid ? 'active' : ''}`}
            title={tmpl.isLiquid ? 'Liquid (click to unset)' : 'Not liquid (click to set)'}
            onClick={() => updateTemplate(tmpl.id, { isLiquid: !tmpl.isLiquid })}
          >Liquid</button>
          <button
            className={`cat-flag-btn ${tmpl.isInvestable ? 'active investable' : ''}`}
            title={tmpl.isInvestable ? 'Investable (click to unset)' : 'Not investable (click to set)'}
            onClick={() => updateTemplate(tmpl.id, { isInvestable: !tmpl.isInvestable })}
          >Investable</button>
        </span>

        {usage && (usage.itemCount > 0) && (
          <span className="cat-manager__usage" title={`${usage.itemCount} items across ${usage.snapshotCount} snapshot(s)`}>
            {usage.itemCount} items
          </span>
        )}

        {/* Rename */}
        {isEditing ? (
          <button className="btn-icon" aria-label="Confirm rename" onClick={commitEdit}><Check size={14} /></button>
        ) : (
          <button className="btn-icon" aria-label="Rename category" onClick={() => startEdit(tmpl)}><Pencil size={14} /></button>
        )}

        {/* Show / Hide from new snapshots */}
        <button
          className="btn-icon"
          aria-label={tmpl.disabled ? 'Show in new snapshots' : 'Hide from new snapshots'}
          title={tmpl.disabled
            ? 'Hidden — not added to new snapshots. Click to show.'
            : hasItems
              ? `Hide from new snapshots (has ${usage?.itemCount} saved items — hiding keeps history intact)`
              : 'Hide from new snapshots'}
          onClick={() => updateTemplate(tmpl.id, { disabled: !tmpl.disabled })}
        >
          {tmpl.disabled ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        {/* Delete — only when custom and no items */}
        {!tmpl.isBuiltIn && (
          <button
            className="btn-icon danger"
            aria-label="Remove category"
            disabled={hasItems}
            title={hasItems
              ? `Cannot delete — ${usage?.itemCount} items saved across ${usage?.snapshotCount} snapshot(s). Disable instead.`
              : 'Remove category'}
            onClick={() => !hasItems && deleteTemplate(tmpl.id)}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="cat-manager">
      <div className="cat-manager__header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 className="text-h2" style={{ marginBottom: 0 }}>Categories</h2>
          <button
            className="btn btn-outline"
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
            onClick={handleCheckCategoryIds}
            disabled={checkingIds}
            title="Finds a built-in category whose internal id doesn't match its name (e.g. from older data) and fixes it, keeping any goal exclusions in sync"
          >
            <ShieldCheck size={13} /> {checkingIds ? 'Checking…' : 'Check category IDs'}
          </button>
        </div>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
          Configure which categories appear in new snapshots and how they count in calculations.
        </p>
      </div>

      <div className="cat-manager__flag-legend">
        <span className="cat-flag-legend-item">
          <span className="cat-flag-btn active" style={{ cursor: 'default' }}>Liquid</span>
          <InfoTooltip body={HELP.liquidFlag} />
        </span>
        <span className="cat-flag-legend-item">
          <span className="cat-flag-btn active investable" style={{ cursor: 'default' }}>Investable</span>
          <InfoTooltip body={HELP.investableFlag} />
        </span>
        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
          Click a flag badge on any row to toggle it.
        </span>
      </div>

      {assets.length > 0 && (
        <div className="cat-manager__group">
          <h3 className="cat-manager__group-label">Assets</h3>
          <div className="cat-manager__list">{assets.map(renderRow)}</div>
        </div>
      )}

      {liabilities.length > 0 && (
        <div className="cat-manager__group">
          <h3 className="cat-manager__group-label">Liabilities</h3>
          <div className="cat-manager__list">{liabilities.map(renderRow)}</div>
        </div>
      )}

      <div className="cat-manager__form">
        <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          Add a custom category:
        </p>
        <div className="cat-form-row">
          <input
            type="text"
            className="settings-input"
            style={{ flex: 1, maxWidth: '100%' }}
            placeholder="Category name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          />
          <select
            className="settings-input"
            style={{ width: 'auto' }}
            value={type}
            onChange={e => setType(e.target.value as 'asset' | 'liability')}
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
          </select>
          <select
            className="settings-input"
            style={{ width: 'auto' }}
            value={icon}
            onChange={e => setIcon(e.target.value)}
          >
            {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
          </select>
        </div>
        <div className="cat-form-row cat-form-row--flags">
          <label className="cat-checkbox">
            <input type="checkbox" checked={isLiquid} onChange={e => setIsLiquid(e.target.checked)} />
            <span>Liquid</span>
          </label>
          <label className="cat-checkbox">
            <input type="checkbox" checked={isInvestable} onChange={e => setIsInvestable(e.target.checked)} />
            <span>Investable</span>
          </label>
          <button className="btn btn-outline" onClick={handleAdd} disabled={!name.trim()}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
    </div>
  );
};
