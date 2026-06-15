import React, { useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Category, LineItem } from '../../types';
import { calcCategoryTotal } from '../../utils/calculations';
import { LineItemRow } from './LineItemRow';
import { AddItemRow } from './AddItemRow';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { Badge } from '../common/Badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './CategorySection.css';

interface CategorySectionProps {
  category: Category;
  exchangeRates: Record<string, number>;
  snapshotMonth: string;
  onChange: (updated: Category) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({ category, exchangeRates, snapshotMonth, onChange }) => {
  const { preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const enabledCurrencies = preferences?.enabledCurrencies || ['INR', 'USD', 'EUR', 'GBP', 'SGD'];
  const [isExpanded, setIsExpanded] = useState(true);

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
              <AddItemRow
                baseCurrency={baseCurrency}
                enabledCurrencies={enabledCurrencies}
                onAdd={handleAddItem}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};
