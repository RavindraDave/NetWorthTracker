import React from 'react';
import { useApp } from '../../context/AppContext';
import { LineItem } from '../../types';
import { convertToBase } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { InclusionChips, exclusionStateToInclusion, inclusionToExclusionState } from '../common/InclusionChips';
import { useDecimalInput } from '../../hooks/useDecimalInput';
import { Trash2 } from 'lucide-react';
import './LineItemRow.css';

type ExclusionState = 'all' | 'goals-only' | 'everywhere';

function getExclusionState(item: LineItem): ExclusionState {
  if (item.excludeFromNetWorth) return 'everywhere';
  if (item.excludeFromGoals)    return 'goals-only';
  return 'all';
}

function applyExclusionState(item: LineItem, state: ExclusionState): LineItem {
  return {
    ...item,
    excludeFromNetWorth: state === 'everywhere',
    excludeFromGoals:    state === 'goals-only',
  };
}

interface LineItemRowProps {
  item: LineItem;
  exchangeRates: Record<string, number>;
  onChange: (updated: LineItem) => void;
  onRemove: (id: string) => void;
}

const LineItemRowBase: React.FC<LineItemRowProps> = ({ item, exchangeRates, onChange, onRemove }) => {
  const { preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const enabledCurrencies = preferences?.enabledCurrencies || ['INR', 'USD', 'EUR', 'GBP', 'SGD'];

  const baseAmount = convertToBase(item.amount, item.currency, baseCurrency, exchangeRates);

  const amountInput = useDecimalInput({
    value: item.amount,
    onCommit: (next) => onChange({ ...item, amount: next }),
    precision: 2,
    min: 0,
    max: 1e15,
  });

  const exclusionState = getExclusionState(item);
  const inclusionVal = exclusionStateToInclusion(exclusionState);

  return (
    <div className={`line-item-row${exclusionState === 'everywhere' ? ' li-excluded' : ''}`}>
      <input
        type="text"
        className="line-item-input name-input"
        value={item.name}
        onChange={e => onChange({ ...item, name: e.target.value })}
        placeholder="Item Name"
        aria-label="Item name"
      />

      <select
        className="line-item-select"
        value={item.currency}
        onChange={e => onChange({ ...item, currency: e.target.value })}
        aria-label="Currency"
      >
        {enabledCurrencies.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <input
        {...amountInput.inputProps}
        className="line-item-input amount-input"
        placeholder="0.00"
        aria-label={`Amount in ${item.currency}`}
      />

      <div className="line-item-base">
        {item.currency !== baseCurrency && (
          <span className="converted-amount">
            ≈ <CurrencyDisplay amount={baseAmount} currency={baseCurrency} />
          </span>
        )}
      </div>

      <InclusionChips
        value={inclusionVal}
        onChange={next => onChange(applyExclusionState(item, inclusionToExclusionState(next)))}
        size="sm"
      />

      <button
        className="btn-icon danger"
        onClick={() => onRemove(item.id)}
        title="Remove item"
        aria-label="Remove item"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

export const LineItemRow = React.memo(LineItemRowBase);
