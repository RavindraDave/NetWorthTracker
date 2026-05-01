import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Category, LineItem } from '../../types';
import { calcCategoryTotal } from '../../utils/calculations';
import { LineItemRow } from './LineItemRow';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { Badge } from '../common/Badge';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import './CategorySection.css';

interface CategorySectionProps {
  category: Category;
  exchangeRates: Record<string, number>;
  onChange: (updated: Category) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({ category, exchangeRates, onChange }) => {
  const { preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const [isExpanded, setIsExpanded] = useState(true);

  const total = calcCategoryTotal(category, baseCurrency, exchangeRates);

  const handleAddItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      name: '',
      amount: 0,
      currency: baseCurrency,
      excludeFromNetWorth: false
    };
    onChange({ ...category, items: [...category.items, newItem] });
  };

  const handleUpdateItem = (updated: LineItem) => {
    onChange({
      ...category,
      items: category.items.map(item => item.id === updated.id ? updated : item)
    });
  };

  const handleRemoveItem = (id: string) => {
    onChange({
      ...category,
      items: category.items.filter(item => item.id !== id)
    });
  };

  return (
    <div className="category-section glass-card">
      <div 
        className="category-section__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="category-section__title-group">
          <span className="category-section__toggle">
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </span>
          <span className="category-section__name">{category.name}</span>
          <Badge variant={category.type === 'asset' ? 'positive' : 'negative'}>
            {category.type}
          </Badge>
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
                  onChange={handleUpdateItem}
                  onRemove={() => handleRemoveItem(item.id)}
                />
              ))}
            </div>
          )}
          
          <button className="btn btn-outline category-section__add-btn" onClick={handleAddItem}>
            <Plus size={16} style={{ marginRight: '0.25rem' }} /> Add Item
          </button>
        </div>
      )}
    </div>
  );
};
