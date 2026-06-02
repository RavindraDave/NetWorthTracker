import React, { useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Category, LineItem } from '../../types';
import { calcCategoryTotal } from '../../utils/calculations';
import { LineItemRow } from './LineItemRow';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { useDecimalInput } from '../../hooks/useDecimalInput';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import './CategorySection.css';

interface CategorySectionProps {
  category: Category;
  exchangeRates: Record<string, number>;
  snapshotMonth: string;
  onChange: (updated: Category) => void;
}

interface AddItemModalProps {
  categoryName: string;
  baseCurrency: string;
  enabledCurrencies: string[];
  onAdd: (item: LineItem) => void;
  onAddAnother: (item: LineItem) => void;
  onClose: () => void;
}

const AddItemModal: React.FC<AddItemModalProps> = ({
  categoryName,
  baseCurrency,
  enabledCurrencies,
  onAdd,
  onAddAnother,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [amount, setAmount] = useState(0);

  const amountInput = useDecimalInput({ value: amount, onCommit: setAmount, precision: 2, min: 0 });

  // For validation we also check the live display text in case the user hasn't blurred yet
  const pendingAmount = amount || parseFloat(amountInput.inputProps.value) || 0;
  const isValid = name.trim().length > 0 && pendingAmount > 0;

  const buildItem = (): LineItem => ({
    id: crypto.randomUUID(),
    name: name.trim(),
    amount: pendingAmount,
    currency,
    excludeFromNetWorth: false,
  });

  const handleAdd = () => {
    if (isValid) { onAdd(buildItem()); onClose(); }
  };

  const handleAddAnother = () => {
    if (isValid) {
      onAddAnother(buildItem());
      setName('');
      setAmount(0);
      setCurrency(baseCurrency);
    }
  };

  return (
    <Modal
      onClose={onClose}
      className="add-item-modal"
      aria-label={`Add item to ${categoryName}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'nowrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', minWidth: 0, overflow: 'hidden' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Add Item</h3>
          <span className="text-muted" style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {categoryName}
          </span>
        </div>
        <button className="btn-icon" onClick={onClose} title="Close" aria-label="Close" style={{ flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      <div className="add-item-modal__body">
        <div className="add-item-modal__field">
          <label className="add-item-modal__label">Item Name</label>
          <input
            type="text"
            className="line-item-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && isValid) handleAdd(); }}
            placeholder="e.g. Kotak NRE - XX7788"
            autoComplete="off"
          />
        </div>

        <div className="add-item-modal__row">
          <div className="add-item-modal__field" style={{ flex: '0 0 auto' }}>
            <label className="add-item-modal__label">Currency</label>
            <select
              className="line-item-select"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              aria-label="Currency"
              style={{ padding: '0.5rem 0.6rem', minWidth: '80px' }}
            >
              {enabledCurrencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="add-item-modal__field" style={{ flex: '1 1 auto' }}>
            <label className="add-item-modal__label">Amount</label>
            <input
              {...amountInput.inputProps}
              className="line-item-input amount-input"
              placeholder="0.00"
              aria-label={`Amount in ${currency}`}
              onKeyDown={e => { if (e.key === 'Enter' && isValid) handleAdd(); }}
            />
          </div>
        </div>
      </div>

      <div className="add-item-modal__footer">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-outline"
            onClick={handleAddAnother}
            disabled={!isValid}
            title="Save this item and add another"
          >
            Add &amp; Another
          </button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!isValid}>
            Add Item
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const CategorySection: React.FC<CategorySectionProps> = ({ category, exchangeRates, snapshotMonth, onChange }) => {
  const { preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const enabledCurrencies = preferences?.enabledCurrencies || ['INR', 'USD', 'EUR', 'GBP', 'SGD'];
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const total = calcCategoryTotal(category, baseCurrency, exchangeRates);

  const handleAddItem = useCallback((item: LineItem) => {
    onChange({ ...category, items: [...category.items, item] });
  }, [category, onChange]);

  const handleUpdateItem = useCallback((updated: LineItem) => {
    onChange({ ...category, items: category.items.map(i => i.id === updated.id ? updated : i) });
  }, [category, onChange]);

  const handleRemoveItem = useCallback((id: string) => {
    onChange({ ...category, items: category.items.filter(i => i.id !== id) });
  }, [category, onChange]);

  return (
    <>
      <div className="category-section glass-card">
        <div className="category-section__header" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="category-section__title-group">
            <span className="category-section__toggle">
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </span>
            <span className="category-section__name">{category.name}</span>
            <Badge variant={category.type === 'asset' ? 'positive' : 'negative'}>{category.type}</Badge>
            <span className="category-section__count">{category.items.length} items</span>
          </div>
          <div className={`category-section__total ${category.type === 'asset' ? 'positive' : 'negative'}`}>
            <CurrencyDisplay amount={total} currency={baseCurrency} />
          </div>
        </div>

        {isExpanded && (
          <div className="category-section__body">
            {category.items.length === 0 ? (
              <div className="category-section__empty">
                No items in this category. Click "Add Item" to start.
              </div>
            ) : (
              <div className="category-section__items">
                {category.items.map(item => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    exchangeRates={exchangeRates}
                    snapshotMonth={snapshotMonth}
                    onChange={handleUpdateItem}
                    onRemove={handleRemoveItem}
                  />
                ))}
              </div>
            )}

            <button
              className="btn btn-outline category-section__add-btn"
              onClick={e => { e.stopPropagation(); setShowAddModal(true); }}
            >
              <Plus size={16} style={{ marginRight: '0.25rem' }} /> Add Item
            </button>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddItemModal
          categoryName={category.name}
          baseCurrency={baseCurrency}
          enabledCurrencies={enabledCurrencies}
          onAdd={handleAddItem}
          onAddAnother={handleAddItem}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  );
};
