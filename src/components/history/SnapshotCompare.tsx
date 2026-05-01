import React, { useMemo } from 'react';
import { Snapshot } from '../../types';
import { calcNetWorth, convertToBase } from '../../utils/calculations';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './SnapshotCompare.css';

interface SnapshotCompareProps {
  snapA: Snapshot;
  snapB: Snapshot;
  baseCurrency: string;
  onClose: () => void;
}

export const SnapshotCompare: React.FC<SnapshotCompareProps> = ({ snapA, snapB, baseCurrency, onClose }) => {
  // Always compare earlier → later
  const [earlier, later] = snapA.month <= snapB.month ? [snapA, snapB] : [snapB, snapA];

  const nwEarlier = calcNetWorth(earlier, baseCurrency, 'overall');
  const nwLater   = calcNetWorth(later,   baseCurrency, 'overall');
  const nwDelta   = nwLater.netWorth - nwEarlier.netWorth;

  const rows = useMemo(() => {
    // Build a unified set of category names
    const catNames = new Set([
      ...earlier.categories.map(c => c.name),
      ...later.categories.map(c => c.name),
    ]);

    return Array.from(catNames).map(catName => {
      const catA = earlier.categories.find(c => c.name === catName);
      const catB = later.categories.find(c => c.name === catName);

      const totalA = (catA?.items ?? []).reduce(
        (sum, item) => sum + convertToBase(item.amount, item.currency, baseCurrency, earlier.exchangeRates), 0
      );
      const totalB = (catB?.items ?? []).reduce(
        (sum, item) => sum + convertToBase(item.amount, item.currency, baseCurrency, later.exchangeRates), 0
      );
      const delta = totalB - totalA;
      const type  = catA?.type ?? catB?.type ?? 'asset';

      return { catName, totalA, totalB, delta, type };
    }).filter(r => r.totalA !== 0 || r.totalB !== 0);
  }, [earlier, later, baseCurrency]);

  const fmtMonth = (m: string) =>
    new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="compare-overlay" role="dialog" aria-modal="true" aria-label="Snapshot Comparison">
      <div className="compare-modal glass-card">
        <div className="compare-modal__header">
          <h2 className="text-h2">Snapshot Comparison</h2>
          <button className="btn-icon" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Net Worth Delta */}
        <div className="compare-nw-row">
          <div className="compare-nw-col">
            <p className="text-muted">{fmtMonth(earlier.month)}</p>
            <p className="compare-nw-amount"><CurrencyDisplay amount={nwEarlier.netWorth} currency={baseCurrency} /></p>
          </div>
          <div className="compare-arrow">→</div>
          <div className="compare-nw-col">
            <p className="text-muted">{fmtMonth(later.month)}</p>
            <p className="compare-nw-amount"><CurrencyDisplay amount={nwLater.netWorth} currency={baseCurrency} /></p>
          </div>
          <div className={`compare-delta ${nwDelta >= 0 ? 'positive' : 'negative'}`}>
            {nwDelta >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            <CurrencyDisplay amount={Math.abs(nwDelta)} currency={baseCurrency} abbreviated />
          </div>
        </div>

        {/* Category breakdown */}
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">{fmtMonth(earlier.month)}</th>
                <th className="text-right">{fmtMonth(later.month)}</th>
                <th className="text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.catName} data-type={r.type}>
                  <td>{r.catName}</td>
                  <td className="text-right">
                    <CurrencyDisplay amount={r.totalA} currency={baseCurrency} abbreviated />
                  </td>
                  <td className="text-right">
                    <CurrencyDisplay amount={r.totalB} currency={baseCurrency} abbreviated />
                  </td>
                  <td className="text-right">
                    <span className={`compare-change ${r.delta > 0 ? 'positive' : r.delta < 0 ? 'negative' : 'neutral'}`}>
                      {r.delta === 0
                        ? <Minus size={12} />
                        : <CurrencyDisplay amount={Math.abs(r.delta)} currency={baseCurrency} abbreviated />
                      }
                      {r.delta !== 0 && (r.delta > 0 ? ' ↑' : ' ↓')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
