import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppBase } from '../hooks/useAppBase';
import { calcNetWorth, convertToBase } from '../utils/calculations';
import { FlattenedItem } from '../types';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import { Badge } from '../components/common/Badge';
import { DonutChart } from '../components/dashboard/DonutChart';
import { InfoTooltip } from '../components/common/InfoTooltip';
import { MissingRateBanner } from '../components/common/MissingRateBanner';
import { LayoutGrid, ChevronRight, Edit2 } from 'lucide-react';
import { subCategoryName } from '../utils/subCategories';
import './Portfolio.css';

/**
 * Category, plus its sub-group when the item has one. Deliberately a second badge
 * in the existing cell rather than a sixth column: the table's whole point is
 * "biggest holdings first across everything", and a new column would cost layout
 * work on every breakpoint to show a value most rows leave blank.
 */
const CategoryCell: React.FC<{ name: string; sub?: string }> = ({ name, sub }) => (
  <span className="portfolio-cat-cell">
    <Badge variant="default">{name}</Badge>
    {sub && (
      <>
        <ChevronRight size={11} className="portfolio-cat-cell__sep" aria-hidden="true" />
        <Badge variant="default" className="portfolio-cat-cell__sub">{sub}</Badge>
      </>
    )}
  </span>
);

export const Portfolio: React.FC = () => {
  const { currentSnapshot, baseCurrency } = useAppBase();
  const navigate = useNavigate();

  const { assets, liabilities, breakdown } = useMemo(() => {
    if (!currentSnapshot) return { assets: [], liabilities: [], breakdown: null };
    
    const breakdown = calcNetWorth(currentSnapshot, baseCurrency, 'overall');
    
    const assetsList: FlattenedItem[] = currentSnapshot.categories
      .filter(c => c.type === 'asset')
      .flatMap(c => c.items.map(i => ({
        ...i,
        categoryName: c.name,
        subCategoryName: subCategoryName(c, i.subCategoryId),
        isLiquid: c.isLiquid,
      })));

    const liabList: FlattenedItem[] = currentSnapshot.categories
      .filter(c => c.type === 'liability')
      .flatMap(c => c.items.map(i => ({
        ...i,
        categoryName: c.name,
        subCategoryName: subCategoryName(c, i.subCategoryId),
      })));

    const sortByAmountDesc = (a: FlattenedItem, b: FlattenedItem) => {
      const aAmt = convertToBase(a.amount, a.currency, baseCurrency, currentSnapshot.exchangeRates);
      const bAmt = convertToBase(b.amount, b.currency, baseCurrency, currentSnapshot.exchangeRates);
      return bAmt - aAmt;
    };

    return { 
      assets: assetsList.sort(sortByAmountDesc), 
      liabilities: liabList.sort(sortByAmountDesc),
      breakdown 
    };
  }, [currentSnapshot, baseCurrency]);

  if (!currentSnapshot || !breakdown) {
    return (
      <div className="wp-page portfolio-page">
        <div className="wp-card empty-state">
          <LayoutGrid size={48} className="empty-state__icon" style={{ opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>No portfolio data yet</h2>
          <p style={{ color: 'var(--text-3)', maxWidth: 320 }}>Create your first snapshot to see your asset allocation and net worth breakdown.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wp-page portfolio-page">
      <MissingRateBanner />
      <div>
        <div className="section-label" style={{ marginBottom: 2 }}>Portfolio Allocation</div>
        <div className="section-sub">Detailed view of your current holdings.</div>
      </div>

      <DonutChart />

      <div className="portfolio-table-section wp-card">
        <div className="portfolio-table-header">
          <h2 className="text-h2">Holdings</h2>
          <Badge variant="positive">Assets</Badge>
        </div>
        
        <div className="table-responsive">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Asset Name</th>
                <th>Category</th>
                <th className="text-right">Original Amount</th>
                <th className="text-right">Value in {baseCurrency}</th>
                <th className="text-right">% of Assets</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => {
                const baseAmt = convertToBase(asset.amount, asset.currency, baseCurrency, currentSnapshot.exchangeRates);
                const percent = breakdown.totalAssets > 0 ? (baseAmt / breakdown.totalAssets) * 100 : 0;

                return (
                  <tr key={asset.id} className={asset.excludeFromNetWorth ? 'excluded' : ''}>
                    <td>
                      <div className="asset-name-col">
                        <span>{asset.name || 'Unnamed Asset'}</span>
                        {asset.excludeFromNetWorth && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <Badge variant="negative" style={{ fontSize: '0.6rem' }}>Excluded</Badge>
                            <InfoTooltip body="Not counted in net worth or FIRE/goal progress." />
                          </span>
                        )}
                        {asset.excludeFromGoals && !asset.excludeFromNetWorth && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <Badge variant="default" style={{ fontSize: '0.6rem' }}>Goal-excluded</Badge>
                            <InfoTooltip body="Counted in net worth, but excluded from FIRE and goal progress." />
                          </span>
                        )}
                      </div>
                    </td>
                    <td><CategoryCell name={asset.categoryName} sub={asset.subCategoryName} /></td>
                    <td className="text-right">
                      {asset.currency !== baseCurrency ? (
                        <span className="text-muted"><CurrencyDisplay amount={asset.amount} currency={asset.currency} /></span>
                      ) : '-'}
                    </td>
                    <td className="text-right" style={{ fontWeight: 600 }}>
                      <CurrencyDisplay amount={baseAmt} currency={baseCurrency} />
                    </td>
                    <td className="text-right text-muted">
                      {asset.excludeFromNetWorth ? '—' : `${percent.toFixed(1)}%`}
                    </td>
                    <td className="text-right">
                      <button
                        className="btn-icon"
                        aria-label={`Edit ${asset.name || 'item'}`}
                        onClick={() => navigate(`/editor/${currentSnapshot.id}`)}
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {liabilities.length > 0 && (
        <div className="portfolio-table-section wp-card">
          <div className="portfolio-table-header">
            <h2 className="text-h2">Outstanding Debt</h2>
            <Badge variant="negative">Liabilities</Badge>
          </div>
          
          <div className="table-responsive">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Liability Name</th>
                  <th>Category</th>
                  <th className="text-right">Original Amount</th>
                  <th className="text-right">Value in {baseCurrency}</th>
                  <th className="text-right">% of Liabilities</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {liabilities.map(liability => {
                  const baseAmt = convertToBase(liability.amount, liability.currency, baseCurrency, currentSnapshot.exchangeRates);
                  const percent = breakdown.totalLiabilities > 0 ? (baseAmt / breakdown.totalLiabilities) * 100 : 0;

                  return (
                    <tr key={liability.id} className={liability.excludeFromNetWorth ? 'excluded' : ''}>
                      <td>
                        <div className="asset-name-col">
                          <span>{liability.name || 'Unnamed Liability'}</span>
                          {liability.excludeFromNetWorth && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <Badge variant="negative" style={{ fontSize: '0.6rem' }}>Excluded</Badge>
                              <InfoTooltip body="Not counted in net worth or FIRE/goal progress." />
                            </span>
                          )}
                          {liability.excludeFromGoals && !liability.excludeFromNetWorth && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <Badge variant="default" style={{ fontSize: '0.6rem' }}>Goal-excluded</Badge>
                              <InfoTooltip body="Counted in net worth, but excluded from FIRE and goal progress." />
                            </span>
                          )}
                        </div>
                      </td>
                      <td><CategoryCell name={liability.categoryName} sub={liability.subCategoryName} /></td>
                      <td className="text-right">
                        {liability.currency !== baseCurrency ? (
                          <span className="text-muted"><CurrencyDisplay amount={liability.amount} currency={liability.currency} /></span>
                        ) : '-'}
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        <CurrencyDisplay amount={baseAmt} currency={baseCurrency} />
                      </td>
                      <td className="text-right text-muted">
                        {liability.excludeFromNetWorth ? '—' : `${percent.toFixed(1)}%`}
                      </td>
                      <td className="text-right">
                        <button
                          className="btn-icon"
                          aria-label={`Edit ${liability.name || 'item'}`}
                          onClick={() => navigate(`/editor/${currentSnapshot.id}`)}
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
