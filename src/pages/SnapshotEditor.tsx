import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { Snapshot, Category } from '../types';
import { calcNetWorth } from '../utils/calculations';
import { ExchangeRateBar } from '../components/editor/ExchangeRateBar';
import { CategorySection } from '../components/editor/CategorySection';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import { useDecimalInput } from '../hooks/useDecimalInput';
import { Save, ArrowLeft, Download, Pencil } from 'lucide-react';
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

  // Block in-app navigation when there are unsaved changes
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirtyRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      confirm('You have unsaved changes. Leave without saving?').then(ok => {
        if (ok) {
          isDirtyRef.current = false;
          blocker.proceed();
        } else {
          blocker.reset();
        }
      });
    }
  }, [blocker, confirm]);

  // Income / expenses inputs — hooks must be called unconditionally
  const incomeInput = useDecimalInput({
    value: snapshot?.monthlyIncome ?? 0,
    onCommit: (next) => {
      isDirtyRef.current = true;
      setSnapshot(prev => prev ? { ...prev, monthlyIncome: next } : prev);
    },
    precision: 2,
    min: 0,
  });

  const expensesInput = useDecimalInput({
    value: snapshot?.monthlyExpenses ?? 0,
    onCommit: (next) => {
      isDirtyRef.current = true;
      setSnapshot(prev => prev ? { ...prev, monthlyExpenses: next } : prev);
    },
    precision: 2,
    min: 0,
  });

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

  const handleBack = async () => {
    if (isDirtyRef.current) {
      const ok = await confirm('You have unsaved changes. Leave without saving?');
      if (!ok) return;
    }
    navigate(-1);
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
          <button className="btn-icon" onClick={handleBack} title="Go back" aria-label="Go back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-h2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Editing
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <input
                  type="month"
                  value={snapshot.month}
                  onChange={e => {
                    if (!e.target.value) return;
                    isDirtyRef.current = true;
                    setSnapshot(prev => prev ? { ...prev, month: e.target.value } : prev);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '2px solid var(--accent-primary)',
                    color: 'inherit',
                    font: 'inherit',
                    fontWeight: 'inherit',
                    cursor: 'pointer',
                    padding: '0 0.25rem',
                    outline: 'none',
                    width: 'auto',
                  }}
                  title="Click to change month"
                />
                <Pencil size={14} style={{ color: 'var(--accent-primary)', opacity: 0.8, flexShrink: 0 }} />
              </span>
            </h1>
            <p className="text-muted" style={{ fontSize: '0.75rem' }}>
              Snapshot ID: {snapshot.id.slice(0,8)}… · <span style={{ color: 'var(--accent-primary)', opacity: 0.75 }}>Click month to change</span>
            </p>
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

      <div className="cashflow-section glass-card" style={{ marginTop: '2rem' }}>
        <h2 className="text-h2" style={{ marginBottom: '1rem' }}>Monthly Cash Flow (Optional)</h2>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="exchange-rate-input-group">
            <label className="exchange-rate-label">Income ({baseCurrency})</label>
            <input
              {...incomeInput.inputProps}
              className="exchange-rate-input"
              style={{ width: '100px' }}
              placeholder="0.00"
              aria-label={`Monthly income in ${baseCurrency}`}
            />
          </div>
          <div className="exchange-rate-input-group">
            <label className="exchange-rate-label">Expenses ({baseCurrency})</label>
            <input
              {...expensesInput.inputProps}
              className="exchange-rate-input"
              style={{ width: '100px' }}
              placeholder="0.00"
              aria-label={`Monthly expenses in ${baseCurrency}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
