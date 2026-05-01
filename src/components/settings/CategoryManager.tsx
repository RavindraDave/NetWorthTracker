import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CategoryTemplate } from '../../types';
import { Plus, Trash2 } from 'lucide-react';
import './CategoryManager.css';

const ICONS = ['wallet', 'trending-up', 'piggy-bank', 'home', 'coins', 'car', 'briefcase', 'globe', 'building', 'credit-card', 'file-text', 'alert-circle', 'layers', 'star', 'shield', 'gift'];

export const CategoryManager: React.FC = () => {
  const { preferences, updatePreferences } = useApp();

  const [name, setName]         = useState('');
  const [type, setType]         = useState<'asset' | 'liability'>('asset');
  const [icon, setIcon]         = useState('layers');
  const [isLiquid, setIsLiquid] = useState(false);
  const [isInvestable, setIsInvestable] = useState(false);

  if (!preferences) return null;

  const customCategories: CategoryTemplate[] = preferences.customCategories ?? [];

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newCat: CategoryTemplate = { name: trimmed, type, icon, isLiquid, isInvestable };
    updatePreferences({ customCategories: [...customCategories, newCat] });
    setName('');
    setIsLiquid(false);
    setIsInvestable(false);
  };

  const handleDelete = (index: number) => {
    updatePreferences({ customCategories: customCategories.filter((_, i) => i !== index) });
  };

  return (
    <div className="cat-manager">
      <h2 className="text-h2" style={{ marginBottom: '0.5rem' }}>Custom Categories</h2>
      <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
        Custom categories appear in every new snapshot you create, alongside the defaults.
      </p>

      {customCategories.length > 0 && (
        <div className="cat-manager__list">
          {customCategories.map((cat, i) => (
            <div key={i} className="cat-manager__item">
              <span className="cat-manager__badge" data-type={cat.type}>{cat.type}</span>
              <span className="cat-manager__name">{cat.name}</span>
              <span className="cat-manager__flags">
                {cat.isLiquid && <span className="cat-flag">Liquid</span>}
                {cat.isInvestable && <span className="cat-flag">Investable</span>}
              </span>
              <button className="btn-icon danger" aria-label="Remove category" onClick={() => handleDelete(i)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="cat-manager__form">
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
