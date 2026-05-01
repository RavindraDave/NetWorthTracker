import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calcNetWorth, convertToBase } from '../utils/calculations';
import { LineItem } from '../types';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import { Badge } from '../components/common/Badge';
import { DonutChart } from '../components/dashboard/DonutChart';
import './Portfolio.css';

export const Portfolio: React.FC = () => {
  const { currentSnapshot, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  const { assets, liabilities, breakdown } = useMemo(() => {
    if (!currentSnapshot) return { assets: [], liabilities: [], breakdown: null };
    
    const breakdown = calcNetWorth(currentSnapshot, baseCurrency, 'overall');
    
    // Flatten line items with category info
    const assetsList = currentSnapshot.categories
      .filter(c => c.type === 'asset')
      .flatMap(c => c.items.map(i => ({ ...i, categoryName: c.name, isLiquid: c.isLiquid })));
      
    const liabList = currentSnapshot.categories
      .filter(c => c.type === 'liability')
      .flatMap(c => c.items.map(i => ({ ...i, categoryName: c.name })));

    interface FlattenedItem extends LineItem {
      categoryName: string;
      isLiquid?: boolean;
    }

    // Sort by converted amount (descending)
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
      <div className="portfolio-empty glass-card text-center" style={{ padding: '4rem' }}>
        <h2 className="text-h2">No Data Available</h2>
        <p className="text-muted">Create a snapshot to view your portfolio.</p>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      <div className="portfolio-header">
        <div>
          <h1 className="text-h1">Portfolio Allocation</h1>
          <p className="text-muted">Detailed view of your current holdings.</p>
        </div>
      </div>

      <div className="portfolio-charts">
        <DonutChart />
      </div>

      <div className="portfolio-table-section glass-card">
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
                <th className="text-right">Local Amount</th>
                <th className="text-right">Value ({baseCurrency})</th>
                <th className="text-right">% of Assets</th>
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
                        {asset.excludeFromNetWorth && <Badge variant="negative" style={{ fontSize: '0.6rem' }}>Excluded</Badge>}
                      </div>
                    </td>
                    <td><Badge variant="default">{asset.categoryName}</Badge></td>
                    <td className="text-right">
                      {asset.currency !== baseCurrency ? (
                        <span className="text-muted"><CurrencyDisplay amount={asset.amount} currency={asset.currency} /></span>
                      ) : '-'}
                    </td>
                    <td className="text-right" style={{ fontWeight: 600 }}>
                      <CurrencyDisplay amount={baseAmt} currency={baseCurrency} />
                    </td>
                    <td className="text-right text-muted">{percent.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {liabilities.length > 0 && (
        <div className="portfolio-table-section glass-card" style={{ marginTop: '2rem' }}>
          <div className="portfolio-table-header">
            <h2 className="text-h2">Holdings</h2>
            <Badge variant="negative">Liabilities</Badge>
          </div>
          
          <div className="table-responsive">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Liability Name</th>
                  <th>Category</th>
                  <th className="text-right">Local Amount</th>
                  <th className="text-right">Value ({baseCurrency})</th>
                  <th className="text-right">% of Liabilities</th>
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
                          {liability.excludeFromNetWorth && <Badge variant="negative" style={{ fontSize: '0.6rem' }}>Excluded</Badge>}
                        </div>
                      </td>
                      <td><Badge variant="default">{liability.categoryName}</Badge></td>
                      <td className="text-right">
                        {liability.currency !== baseCurrency ? (
                          <span className="text-muted"><CurrencyDisplay amount={liability.amount} currency={liability.currency} /></span>
                        ) : '-'}
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        <CurrencyDisplay amount={baseAmt} currency={baseCurrency} />
                      </td>
                      <td className="text-right text-muted">{percent.toFixed(1)}%</td>
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
