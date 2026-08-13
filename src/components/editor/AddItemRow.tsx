import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { LineItem } from '../../types';
import { useDecimalInput } from '../../hooks/useDecimalInput';
import { useApp } from '../../context/AppContext';
import { resolveNumberLocale } from '../../utils/currencies';
import './AddItemRow.css';

interface AddItemRowProps {
  baseCurrency: string;
  enabledCurrencies: string[];
  onAdd: (item: LineItem) => void;
  /** Group the new item is filed into. Absent = ungrouped. */
  subCategoryId?: string;
  /**
   * Group name, used only to disambiguate the aria-labels when a category shows
   * several add rows. Absent for the ungrouped bucket, which deliberately keeps the
   * plain labels so existing selectors (and the e2e helpers) still resolve.
   */
  subCategoryName?: string;
}

export const AddItemRow: React.FC<AddItemRowProps> = ({
  baseCurrency, enabledCurrencies, onAdd, subCategoryId, subCategoryName,
}) => {
  const { preferences } = useApp();
  const locale = resolveNumberLocale(preferences?.baseCurrency ?? 'INR', preferences?.numberFormat);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [amount, setAmount] = useState(0);
  const amountRef = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const amountInput = useDecimalInput({
    value: amount,
    onCommit: next => { amountRef.current = next; setAmount(next); },
    precision: 2,
    min: 0,
    locale,
  });

  const reset = () => {
    setName('');
    setAmount(0);
    amountRef.current = 0;
    // Clear the visible text too. `amount` goes 120000 -> 0 within one batch, so
    // the hook's value-changed resync never fires and the typed figure would linger
    // on screen while the next commit would actually use 0.
    amountInput.reset(0);
    setCurrency(baseCurrency);
  };

  const commit = () => {
    const trimmed = name.trim();
    if (!trimmed) { reset(); return; }
    onAdd({
      id: crypto.randomUUID(),
      name: trimmed,
      amount: amountRef.current,
      currency,
      excludeFromNetWorth: false,
      ...(subCategoryId ? { subCategoryId } : {}),
    });
    reset();
    nameRef.current?.focus();
  };

  // Suffix only named groups. The ungrouped bucket keeps "New item name" / "Add item"
  // so selectors written before sub-categories existed still match exactly one row.
  const inGroup = subCategoryName ? ` in ${subCategoryName}` : '';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      reset();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="line-item-wrap">
      <div className="line-item-row add-item-row">
        <input
          ref={nameRef}
          type="text"
          className="line-item-input name-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="+ Add item"
          aria-label={`New item name${inGroup}`}
        />

        <select
          className="line-item-select"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          aria-label={`New item currency${inGroup}`}
        >
          {enabledCurrencies.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          {...amountInput.inputProps}
          className="line-item-input amount-input"
          placeholder="0.00"
          aria-label={`New item amount in ${currency}${inGroup}`}
          onKeyDown={handleKeyDown}
          onBlur={() => { amountInput.inputProps.onBlur(); if (name.trim()) commit(); }}
        />

        <button
          type="button"
          className="add-item-btn"
          onClick={commit}
          disabled={!name.trim()}
          aria-label={subCategoryName ? `Add item to ${subCategoryName}` : 'Add item'}
          title={subCategoryName ? `Add item to ${subCategoryName}` : 'Add item'}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};
