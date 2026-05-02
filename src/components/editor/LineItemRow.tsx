import React from 'react';
import { useApp } from '../../context/AppContext';
import { LineItem } from '../../types';
import { convertToBase } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import './LineItemRow.css';

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

  return (
    <div className={`line-item-row ${item.excludeFromNetWorth ? 'excluded' : ''}`}>
      <input
        type="text"
        className="line-item-input name-input"
        value={item.name}
        onChange={e => onChange({ ...item, name: e.target.value })}
        placeholder="Item Name"
      />
      
      <div className="line-item-amount-group">
        <select
          className="line-item-select"
          value={item.currency}
          onChange={e => onChange({ ...item, currency: e.target.value })}
        >
          {enabledCurrencies.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        
        <input
          type="number"
          className="line-item-input amount-input"
          value={item.amount === 0 ? '' : item.amount}
          onChange={e => {
            const val = parseFloat(e.target.value);
            const safe = isNaN(val) || !isFinite(val) ? 0 : Math.min(Math.abs(val), 1e15);
            onChange({ ...item, amount: safe });
          }}
          placeholder="0.00"
        />
      </div>

      <div className="line-item-base">
        {item.currency !== baseCurrency && (
          <span className="converted-amount">
            ≈ <CurrencyDisplay amount={baseAmount} currency={baseCurrency} />
          </span>
        )}
      </div>

      <div className="line-item-actions">
        <button 
          className="btn-icon" 
          onClick={() => onChange({ ...item, excludeFromNetWorth: !item.excludeFromNetWorth })}
          title={item.excludeFromNetWorth ? "Include in Net Worth" : "Exclude from Net Worth"}
        >
          {item.excludeFromNetWorth ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button className="btn-icon danger" onClick={() => onRemove(item.id)} title="Remove Item">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export const LineItemRow = React.memo(LineItemRowBase);
