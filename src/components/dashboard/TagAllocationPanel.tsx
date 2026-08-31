import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { buildTagAllocationData } from '../../utils/tagAggregation';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import './TagAllocationPanel.css';

/**
 * Deliberately a bar list, not a donut: a pie implies its slices sum to a
 * whole, and tag totals overlap by design (one item can carry several tags),
 * so a donut here would visually lie. Bars just say "this much is tagged
 * X" without implying a total — the hard visual break from net-worth/category
 * totals the tags feature requires.
 */
export const TagAllocationPanel: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency ?? 'INR';

  const data = useMemo(() => {
    if (!currentSnapshot) return [];
    return buildTagAllocationData(currentSnapshot, baseCurrency);
  }, [currentSnapshot, baseCurrency]);

  if (data.length === 0) return null;

  const max = Math.max(...data.map(d => d.value));

  return (
    <div className="wp-card tag-alloc">
      <div className="section-label">By Tag</div>
      <div className="section-sub" style={{ marginBottom: 14 }}>
        A reporting lens, not a total — items with multiple tags count under each one.
      </div>
      <div className="tag-alloc-list">
        {data.map(d => (
          <div key={d.id} className="tag-alloc-row">
            <div className="tag-alloc-row__head">
              <span className="tag-alloc-row__name">{d.name}</span>
              <CurrencyDisplay amount={d.value} currency={baseCurrency} className="tag-alloc-row__value" abbreviated />
            </div>
            <div className="tag-alloc-bar-track">
              <div className="tag-alloc-bar-fill" style={{ width: `${max > 0 ? (d.value / max) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
