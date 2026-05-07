import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { Snapshot, Category } from '../types';
import { DEFAULT_CATEGORY_TEMPLATES, buildCategoryFromTemplate } from '../utils/defaultCategories';
import { calcNetWorth } from '../utils/calculations';
import { ExchangeRateBar } from '../components/editor/ExchangeRateBar';
import { CategorySection } from '../components/editor/CategorySection';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import { useDecimalInput } from '../hooks/useDecimalInput';
import { Save, Download, FileText, ChevronDown } from 'lucide-react';
import { exportSnapshotToCSV, downloadFile } from '../utils/importExport';
import './SnapshotEditor.css';

export const SnapshotEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { snapshots, saveSnapshot, preferences } = useApp();
  const { confirm, error: toastError } = useToast();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [chipsIntroSeen, setChipsIntroSeen] = useState(
    () => localStorage.getItem('wp_chips_intro_seen') === '1'
  );
  const isDirtyRef = useRef(false);
  const prevIdRef = useRef<string | null>(null);

  const dismissChipsIntro = () => {
    localStorage.setItem('wp_chips_intro_seen', '1');
    setChipsIntroSeen(true);
  };

  useEffect(() => {
    if (id) {
      const existing = snapshots.find(s => s.id === id);
      if (existing) {
        const snap: Snapshot = JSON.parse(JSON.stringify(existing));

        const allTemplates = preferences?.categoryTemplates ?? DEFAULT_CATEGORY_TEMPLATES;
        const enabledTemplates = allTemplates.filter(t => !t.disabled);
        const missing = enabledTemplates.filter(
          t => !snap.categories.some(c => c.id === t.id || (c.name === t.name && c.type === t.type))
        );
        if (missing.length > 0) {
          snap.categories = [...snap.categories, ...missing.map(buildCategoryFromTemplate)];
        }

        setSnapshot(snap);
        isDirtyRef.current = false;

        // Auto-open note area if notes exist on first load
        if (snap.id !== prevIdRef.current) {
          prevIdRef.current = snap.id;
          if (snap.notes) setNoteOpen(true);
        }
      }
    }
  }, [id, snapshots, preferences?.categoryTemplates]);

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
    return <div className="wp-page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-3)' }}>Loading snapshot…</div>;
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
      return { ...prev, exchangeRates: { ...prev.exchangeRates, ...rates }, ratesLastUpdated: updatedAt };
    });
  };

  const handleCategoryChange = (updated: Category) => {
    isDirtyRef.current = true;
    setSnapshot({ ...snapshot, categories: snapshot.categories.map(c => c.id === updated.id ? updated : c) });
  };

  const handleSave = async () => {
    const monthDisplay = new Date(snapshot.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

  const breakdown = calcNetWorth(snapshot, baseCurrency);

  // Goals NW: exclude items marked as excludeFromGoals
  const goalsNW = calcNetWorth(
    {
      ...snapshot,
      categories: snapshot.categories.map(cat => ({
        ...cat,
        items: cat.items.map(item =>
          item.excludeFromGoals ? { ...item, excludeFromNetWorth: true } : item
        ),
      })),
    },
    baseCurrency
  ).netWorth;

  const assets = snapshot.categories.filter(c => c.type === 'asset');
  const liabilities = snapshot.categories.filter(c => c.type === 'liability');

  const notePreview = snapshot.notes
    ? snapshot.notes.slice(0, 72) + (snapshot.notes.length > 72 ? '…' : '')
    : 'Add a note for this month…';

  return (
    <div className="wp-page editor-page">
      {/* Header */}
      <div className="editor-header">
        <div className="editor-header-left">
          <div className="month-pill-wrap">
            <input
              type="month"
              className="month-pill"
              value={snapshot.month}
              onChange={e => {
                if (!e.target.value) return;
                isDirtyRef.current = true;
                setSnapshot(prev => prev ? { ...prev, month: e.target.value } : prev);
              }}
              title="Click to change month"
              aria-label="Snapshot month"
            />
          </div>
          <span className="editor-id-hint">ID {snapshot.id.slice(0, 8)}…</span>
        </div>

        <div className="editor-header-right">
          <div className="live-preview">
            <span className="live-preview-label">Live Net Worth</span>
            <CurrencyDisplay
              amount={breakdown.netWorth}
              currency={baseCurrency}
              className={`live-preview-val${breakdown.netWorth < 0 ? ' neg' : ''}`}
            />
          </div>
          <button className="btn btn-outline" onClick={handleExportCSV} title="Export CSV">
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={15} />
            <span>Save Snapshot</span>
          </button>
        </div>
      </div>

      {/* Collapsible Note Area */}
      <div className={`note-area${noteOpen ? ' note-area--open' : ''}`}>
        <button
          className="note-trigger"
          onClick={() => setNoteOpen(o => !o)}
          aria-expanded={noteOpen}
          aria-controls="note-textarea"
        >
          <FileText size={13} />
          <span className="note-trigger-text">{noteOpen ? 'Notes' : notePreview}</span>
          <ChevronDown
            size={13}
            style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform 0.2s', transform: noteOpen ? 'rotate(180deg)' : 'none' }}
          />
        </button>
        {noteOpen && (
          <textarea
            id="note-textarea"
            className="note-textarea"
            placeholder="What changed this month? (e.g., bonus, market move, large purchase)"
            value={snapshot.notes ?? ''}
            maxLength={2000}
            rows={4}
            onChange={e => {
              isDirtyRef.current = true;
              setSnapshot(prev => prev ? { ...prev, notes: e.target.value } : prev);
            }}
          />
        )}
      </div>

      {/* Exchange Rate Bar */}
      <ExchangeRateBar
        rates={snapshot.exchangeRates}
        ratesLastUpdated={snapshot.ratesLastUpdated}
        onChange={handleRateChange}
        onRatesRefreshed={handleRatesRefreshed}
      />

      {/* Cash Flow (optional) */}
      <div className="wp-card cashflow-card">
        <span className="section-label">
          Monthly Cash Flow
          <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>(optional)</span>
        </span>
        <div className="cashflow-inputs">
          <div className="exchange-rate-input-group">
            <label className="exchange-rate-label">Income ({baseCurrency})</label>
            <input
              {...incomeInput.inputProps}
              className="exchange-rate-input"
              placeholder="0.00"
              aria-label={`Monthly income in ${baseCurrency}`}
            />
          </div>
          <div className="exchange-rate-input-group">
            <label className="exchange-rate-label">Expenses ({baseCurrency})</label>
            <input
              {...expensesInput.inputProps}
              className="exchange-rate-input"
              placeholder="0.00"
              aria-label={`Monthly expenses in ${baseCurrency}`}
            />
          </div>
        </div>
      </div>

      {/* Chips intro callout — first-run only */}
      {!chipsIntroSeen && (
        <div className="chips-intro" role="note">
          <p className="chips-intro-lead">Each item has three inclusion states — tap a chip to change it.</p>
          <ul className="chips-intro-list">
            <li><span className="chips-intro-glyph incl-accent">Σ✓</span> Counted in net worth &amp; goals</li>
            <li><span className="chips-intro-glyph incl-amber">Σ</span> Counted in net worth only — excluded from goals</li>
            <li><span className="chips-intro-glyph incl-rose">⊘</span> Excluded from all calculations</li>
          </ul>
          <button className="chips-intro-dismiss btn btn-outline" onClick={dismissChipsIntro}>
            Got it
          </button>
        </div>
      )}

      {/* Two-Column Editor */}
      <div className="editor-cols">
        <div className="editor-col">
          <div className="col-title pos">
            Assets
            <span className="col-total">
              <CurrencyDisplay amount={breakdown.totalAssets} currency={baseCurrency} />
            </span>
          </div>
          {assets.map(cat => (
            <CategorySection key={cat.id} category={cat} exchangeRates={snapshot.exchangeRates} onChange={handleCategoryChange} />
          ))}
        </div>

        <div className="editor-col">
          <div className="col-title neg">
            Liabilities
            <span className="col-total">
              <CurrencyDisplay amount={breakdown.totalLiabilities} currency={baseCurrency} />
            </span>
          </div>
          {liabilities.map(cat => (
            <CategorySection key={cat.id} category={cat} exchangeRates={snapshot.exchangeRates} onChange={handleCategoryChange} />
          ))}
        </div>
      </div>

      {/* Sticky Summary Bar */}
      <div className="editor-summary">
        <div className="summ-block">
          <span className="summ-label">Net Worth</span>
          <span className={`summ-val${breakdown.netWorth >= 0 ? ' pos' : ' neg'}`}>
            <CurrencyDisplay amount={breakdown.netWorth} currency={baseCurrency} abbreviated />
          </span>
        </div>
        <div className="summ-sep" />
        <div className="summ-block">
          <span className="summ-label">Goals NW</span>
          <span className="summ-val">
            <CurrencyDisplay amount={goalsNW} currency={baseCurrency} abbreviated />
          </span>
        </div>
        <div className="summ-sep" />
        <div className="summ-block">
          <span className="summ-label">Total Assets</span>
          <span className="summ-val pos">
            <CurrencyDisplay amount={breakdown.totalAssets} currency={baseCurrency} abbreviated />
          </span>
        </div>
        <div className="summ-sep" />
        <div className="summ-block">
          <span className="summ-label">Total Liabilities</span>
          <span className="summ-val neg">
            <CurrencyDisplay amount={breakdown.totalLiabilities} currency={baseCurrency} abbreviated />
          </span>
        </div>
      </div>
    </div>
  );
};
