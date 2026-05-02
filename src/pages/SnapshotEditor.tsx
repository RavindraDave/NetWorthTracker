import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { Snapshot, Category } from '../types';
import { calcNetWorth } from '../utils/calculations';
import { ExchangeRateBar } from '../components/editor/ExchangeRateBar';
import { CategorySection } from '../components/editor/CategorySection';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import { Save, ArrowLeft, Download } from 'lucide-react';
import { exportSnapshotToCSV, downloadFile } from '../utils/importExport';
import './SnapshotEditor.css';

export const SnapshotEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { snapshots, saveSnapshot, preferences } = useApp();
  const { confirm, error: toastError } = useToast();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (id) {
      const existing = snapshots.find(s => s.id === id);
      if (existing) {
        setSnapshot(JSON.parse(JSON.stringify(existing)));
        isDirtyRef.current = false;
      }
    }
  }, [id, snapshots]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleExportCSV = () => {
    if (!snapshot) return;
    const csv = exportSnapshotToCSV(snapshot);
    downloadFile(csv, `snapshot-${snapshot.month}.csv`, 'text/csv');
  };

  if (!snapshot) {
    return <div className="p-8 text-center text-muted">Snapshot not found or loading...</div>;
  }

  const handleRateChange = (currency: string, rate: number) => {
    isDirtyRef.current = true;
    setSnapshot({
      ...snapshot,
      exchangeRates: { ...snapshot.exchangeRates, [currency]: rate },
      ratesLastUpdated: new Date().toISOString(),
    });
  };

  const handleRatesRefreshed = (rates: Record<string, number>, updatedAt: string) => {
    isDirtyRef.current = true;
    setSnapshot(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        exchangeRates: { ...prev.exchangeRates, ...rates },
        ratesLastUpdated: updatedAt,
      };
    });
  };

  const handleCategoryChange = (updated: Category) => {
    isDirtyRef.current = true;
    setSnapshot({
      ...snapshot,
      categories: snapshot.categories.map(c => c.id === updated.id ? updated : c)
    });
  };

  const handleSave = async () => {
    const duplicate = snapshots.find(s => s.month === snapshot.month && s.id !== snapshot.id);
    if (duplicate) {
      const ok = await confirm(`A snapshot for ${monthDisplay} already exists. Saving will overwrite it. Continue?`);
      if (!ok) return;
    }
    isDirtyRef.current = false;
    try {
      await saveSnapshot({ ...snapshot, updatedAt: new Date().toISOString() });
      navigate('/');
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('duplicate_month:')) {
        toastError(`A snapshot for ${monthDisplay} already exists. Delete it first or change the month.`);
        isDirtyRef.current = true;
      } else {
        toastError('Failed to save snapshot. Please try again.');
        isDirtyRef.current = true;
      }
    }
  };

  const monthDisplay = new Date(snapshot.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const breakdown = calcNetWorth(snapshot, baseCurrency);

  const assets = snapshot.categories.filter(c => c.type === 'asset');
  const liabilities = snapshot.categories.filter(c => c.type === 'liability');

  return (
    <div className="snapshot-editor">
      <div className="editor-header">
        <div className="editor-header__left">
          <button className="btn-icon" onClick={() => navigate(-1)} title="Go back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-h2">Editing {monthDisplay}</h1>
            <p className="text-muted">Snapshot ID: {snapshot.id.slice(0,8)}...</p>
          </div>
        </div>
        
        <div className="editor-header__right">
          <div className="live-networth glass-card">
            <span className="live-networth__label">Live Net Worth</span>
            <CurrencyDisplay amount={breakdown.netWorth} currency={baseCurrency} className="live-networth__amount" />
          </div>
          <button className="btn btn-outline" onClick={handleExportCSV} title="Export CSV">
            <Download size={16} />
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} style={{ marginRight: '0.5rem' }} /> Save Snapshot
          </button>
        </div>
      </div>

      <ExchangeRateBar
        rates={snapshot.exchangeRates}
        ratesLastUpdated={snapshot.ratesLastUpdated}
        onChange={handleRateChange}
        onRatesRefreshed={handleRatesRefreshed}
      />

      <div className="editor-grid">
        <div className="editor-column">
          <div className="editor-column__header">
            <h2 className="text-h2">Assets</h2>
            <div className="editor-column__total positive">
              <CurrencyDisplay amount={breakdown.totalAssets} currency={baseCurrency} />
            </div>
          </div>
          {assets.map(cat => (
            <CategorySection key={cat.id} category={cat} exchangeRates={snapshot.exchangeRates} onChange={handleCategoryChange} />
          ))}
        </div>

        <div className="editor-column">
          <div className="editor-column__header">
            <h2 className="text-h2">Liabilities</h2>
            <div className="editor-column__total negative">
              <CurrencyDisplay amount={breakdown.totalLiabilities} currency={baseCurrency} />
            </div>
          </div>
          {liabilities.map(cat => (
            <CategorySection key={cat.id} category={cat} exchangeRates={snapshot.exchangeRates} onChange={handleCategoryChange} />
          ))}
        </div>
      </div>

      {/* Cash Flow Section */}
      <div className="cashflow-section glass-card" style={{ marginTop: '2rem' }}>
        <h2 className="text-h2" style={{ marginBottom: '1rem' }}>Monthly Cash Flow (Optional)</h2>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="exchange-rate-input-group">
            <label className="exchange-rate-label">Income ({baseCurrency})</label>
            <input
              type="number"
              className="exchange-rate-input"
              style={{ width: '100px' }}
              value={snapshot.monthlyIncome || ''}
              onChange={e => { isDirtyRef.current = true; setSnapshot({ ...snapshot, monthlyIncome: parseFloat(e.target.value) || 0 }); }}
              placeholder="0.00"
            />
          </div>
          <div className="exchange-rate-input-group">
            <label className="exchange-rate-label">Expenses ({baseCurrency})</label>
            <input
              type="number"
              className="exchange-rate-input"
              style={{ width: '100px' }}
              value={snapshot.monthlyExpenses || ''}
              onChange={e => { isDirtyRef.current = true; setSnapshot({ ...snapshot, monthlyExpenses: parseFloat(e.target.value) || 0 }); }}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
