import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useBlocker, useLocation } from 'react-router-dom';
import { useAppBase } from '../hooks/useAppBase';
import { Snapshot, Category } from '../types';
import { DEFAULT_CATEGORY_TEMPLATES, buildCategoryFromTemplate } from '../utils/defaultCategories';
import { calcNetWorth } from '../utils/calculations';
import { pruneOrphanSubCategoryIds } from '../utils/subCategories';
import { ensureTag, pruneOrphanTagIds } from '../utils/tags';
import { ExchangeRateBar } from '../components/editor/ExchangeRateBar';
import { CategorySection } from '../components/editor/CategorySection';
import { TagManager } from '../components/editor/TagManager';
import { CurrencyDisplay } from '../components/common/CurrencyDisplay';
import { useDecimalInput } from '../hooks/useDecimalInput';
import { resolveNumberLocale } from '../utils/currencies';
import { isLoanConfigComplete } from '../utils/loanCalculator';
import { Save, Download, FileText, ChevronDown, FileSpreadsheet, Printer, CheckCircle2, X, Tags } from 'lucide-react';
import { InfoTooltip } from '../components/common/InfoTooltip';
import { exportSnapshotToCSV, downloadFile, exportSnapshotToExcel } from '../utils/importExport';
import { printSnapshotReport } from '../utils/printReport';
import './SnapshotEditor.css';

interface ImportSummary {
  itemCount: number;
  categoryCount: number;
  month: string;
  fileName: string;
  missingNameCount?: number;
  badAmountCount?: number;
  unknownCurrencyCount?: number;
  /** Present only for an "update existing month" import — absent means a plain new-snapshot import. */
  updatedCount?: number;
  insertedCount?: number;
}

export const SnapshotEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { snapshots, saveSnapshot, preferences, confirm, error: toastError, info: toastInfo, warning: toastWarning, baseCurrency } = useAppBase();
  const locale = resolveNumberLocale(preferences?.baseCurrency ?? 'INR', preferences?.numberFormat);

  // Post-import summary banner (BL-5) — read once from navigation state, then clear
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    () => (location.state as { importSummary?: ImportSummary } | null)?.importSummary ?? null
  );
  useEffect(() => {
    if (location.state && (location.state as { importSummary?: ImportSummary }).importSummary) {
      // Clear router state so the banner doesn't reappear on refresh or back-navigation
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [chipsIntroSeen, setChipsIntroSeen] = useState(
    () => localStorage.getItem('wp_chips_intro_seen') === '1'
  );
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
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
    locale,
  });

  const expensesInput = useDecimalInput({
    value: snapshot?.monthlyExpenses ?? 0,
    onCommit: (next) => {
      isDirtyRef.current = true;
      setSnapshot(prev => prev ? { ...prev, monthlyExpenses: next } : prev);
    },
    precision: 2,
    min: 0,
    locale,
  });

  const handleExportCSV = () => {
    if (!snapshot) return;
    const csv = exportSnapshotToCSV(snapshot);
    downloadFile(csv, `snapshot-${snapshot.month}.csv`, 'text/csv');
  };

  const handleExportExcel = () => {
    if (!snapshot) return;
    exportSnapshotToExcel(snapshot, baseCurrency);
  };

  const handlePrint = () => {
    if (!snapshot) return;
    const ok = printSnapshotReport(snapshot, baseCurrency, preferences?.numberFormat);
    if (!ok) toastError('Could not open the print preview — check if your browser blocked the popup.');
  };

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node))
        setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

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

  /**
   * Assigning a NEW tag is one update over both `snapshot.tags` and the target
   * item's `tagIds` — same reason as `handleAssignSubCategory` in
   * `CategorySection`: two separate state writes in one tick would each read
   * the same stale `snapshot` and the second would clobber the first.
   */
  const handleAssignTags = (
    categoryId: string,
    itemId: string,
    target: { toggleId: string } | { newName: string },
  ) => {
    isDirtyRef.current = true;
    setSnapshot(prev => {
      if (!prev) return prev;

      const applyToItem = (base: Snapshot, tagId: string, toggle: boolean): Snapshot => ({
        ...base,
        categories: base.categories.map(c => {
          if (c.id !== categoryId) return c;
          return {
            ...c,
            items: c.items.map(i => {
              if (i.id !== itemId) return i;
              const has = i.tagIds?.includes(tagId) ?? false;
              if (toggle && has) {
                const next = (i.tagIds ?? []).filter(id => id !== tagId);
                const { tagIds: _dropped, ...rest } = i;
                return next.length > 0 ? { ...rest, tagIds: next } : rest;
              }
              if (has) return i; // already tagged, e.g. re-typing an existing tag's name
              return { ...i, tagIds: [...(i.tagIds ?? []), tagId] };
            }),
          };
        }),
      });

      if ('newName' in target) {
        const { snapshot: withTag, id } = ensureTag(prev, target.newName);
        return applyToItem(withTag, id, false);
      }
      return applyToItem(prev, target.toggleId, true);
    });
  };

  const handleTagsChange = (updated: Snapshot) => {
    isDirtyRef.current = true;
    setSnapshot(updated);
  };

  const handleSave = async () => {
    // Parsed as local (not `new Date(month + '-01')`, which is UTC midnight and can
    // roll to the previous month's label west of UTC) since this drives user-facing copy.
    const [y, m] = snapshot.month.split('-').map(Number);
    const monthDisplay = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const duplicate = snapshots.find(s => s.month === snapshot.month && s.id !== snapshot.id);
    if (duplicate) {
      const ok = await confirm(`A snapshot for ${monthDisplay} already exists. Saving will overwrite it. Continue?`);
      if (!ok) return;
    }
    isDirtyRef.current = false;
    setIsSaving(true);
    try {
      // Self-heal any sub-category reference whose definition is gone (an old backup,
      // hand-edited JSON). Returns the same object when nothing is orphaned, so this
      // is a no-op on virtually every save.
      const cleaned = pruneOrphanTagIds(pruneOrphanSubCategoryIds(snapshot));
      await saveSnapshot({ ...cleaned, updatedAt: new Date().toISOString() });
      navigate('/');
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('duplicate_month:')) {
        toastError(`A snapshot for ${monthDisplay} already exists. Delete it first or change the month.`);
        isDirtyRef.current = true;
      } else {
        toastError('Failed to save snapshot. Please try again.');
        isDirtyRef.current = true;
      }
    } finally {
      setIsSaving(false);
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

  // Only surface exchange-rate prompts once the snapshot actually holds a
  // non-base-currency item — a brand-new INR-only user shouldn't be greeted by
  // a "set your USD rate first" error before entering any data.
  const hasForeignItems = snapshot.categories.some(c =>
    c.items.some(i => i.currency !== baseCurrency)
  );

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
                const loanItemCount = snapshot.categories.reduce(
                  (sum, c) => sum + c.items.filter(i =>
                    isLoanConfigComplete(i.loanPrincipal, i.annualInterestRate, i.tenureMonths, i.loanStartMonth)
                  ).length,
                  0
                );
                if (loanItemCount > 0) {
                  toastInfo(`${loanItemCount} loan balance${loanItemCount === 1 ? '' : 's'} will be recalculated for the new month.`);
                }
                if (snapshots.some(s => s.month === e.target.value && s.id !== snapshot.id)) {
                  toastWarning('A snapshot for this month already exists — saving will overwrite it.');
                }
                setSnapshot(prev => prev ? { ...prev, month: e.target.value } : prev);
              }}
              title="Click to change month"
              aria-label="Snapshot month"
            />
          </div>
          <InfoTooltip body={
            <div className="chip-legend">
              <div className="chip-legend-row"><span className="chips-intro-glyph incl-accent">Σ✓</span> Counted in net worth &amp; goals</div>
              <div className="chip-legend-row"><span className="chips-intro-glyph incl-amber">Σ</span> Net worth only — excluded from goals</div>
              <div className="chip-legend-row"><span className="chips-intro-glyph incl-rose">⊘</span> Excluded from everything</div>
            </div>
          } />
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
          <button
            className="btn btn-outline"
            onClick={() => setTagManagerOpen(true)}
            title="Manage this month's tags"
          >
            <Tags size={15} />
            <span>Tags{(snapshot.tags?.length ?? 0) > 0 ? ` (${snapshot.tags!.length})` : ''}</span>
          </button>
          <div className="export-menu-wrap" ref={exportMenuRef}>
            <button
              className="btn btn-outline"
              onClick={() => setShowExportMenu(o => !o)}
              aria-haspopup="true"
              aria-expanded={showExportMenu}
            >
              <Download size={15} />
              <span>Export</span>
              <ChevronDown size={12} style={{ marginLeft: 2, transition: 'transform 0.15s', transform: showExportMenu ? 'rotate(180deg)' : 'none' }} />
            </button>
            {showExportMenu && (
              <div className="export-menu" role="menu">
                <button className="export-menu-item" role="menuitem" onClick={() => { handleExportCSV(); setShowExportMenu(false); }}>
                  <Download size={13} /> CSV
                </button>
                <button className="export-menu-item" role="menuitem" onClick={() => { handleExportExcel(); setShowExportMenu(false); }}>
                  <FileSpreadsheet size={13} /> Excel (.xlsx)
                </button>
                <button className="export-menu-item" role="menuitem" onClick={() => { handlePrint(); setShowExportMenu(false); }}>
                  <Printer size={13} /> Print / PDF
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} aria-busy={isSaving}>
            {isSaving ? <Save size={15} className="spinning" /> : <Save size={15} />}
            <span>{isSaving ? 'Saving…' : 'Save Snapshot'}</span>
          </button>
        </div>
      </div>

      {/* Post-import summary banner (BL-5) */}
      {importSummary && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.65rem 0.9rem', marginBottom: '1rem',
          borderRadius: 'var(--radius-md)',
          background: 'color-mix(in srgb, var(--accent-green, #34d399) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-green, #34d399) 35%, transparent)',
        }}>
          <CheckCircle2 size={16} style={{ color: 'var(--accent-green, #34d399)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {importSummary.updatedCount !== undefined ? (
              <>
                Updated <strong>{importSummary.updatedCount}</strong> item{importSummary.updatedCount === 1 ? '' : 's'} and added{' '}
                <strong>{importSummary.insertedCount}</strong> new one{importSummary.insertedCount === 1 ? '' : 's'} from{' '}
              </>
            ) : (
              <>
                Imported <strong>{importSummary.itemCount}</strong> item{importSummary.itemCount === 1 ? '' : 's'} across{' '}
                <strong>{importSummary.categoryCount}</strong> categor{importSummary.categoryCount === 1 ? 'y' : 'ies'} from{' '}
              </>
            )}
            <span style={{ wordBreak: 'break-all' }}>{importSummary.fileName}</span>. Review and save below.
            {(!!importSummary.missingNameCount || !!importSummary.badAmountCount || !!importSummary.unknownCurrencyCount) && (
              <span style={{ display: 'block', marginTop: '0.3rem', color: 'var(--amber, #f59e0b)' }}>
                {[
                  importSummary.missingNameCount ? `${importSummary.missingNameCount} row${importSummary.missingNameCount === 1 ? '' : 's'} had a missing item name (imported as "Imported Item")` : null,
                  importSummary.badAmountCount ? `${importSummary.badAmountCount} row${importSummary.badAmountCount === 1 ? '' : 's'} had an unreadable amount (imported as 0)` : null,
                  importSummary.unknownCurrencyCount ? `${importSummary.unknownCurrencyCount} row${importSummary.unknownCurrencyCount === 1 ? '' : 's'} had an unrecognized currency (defaulted to ${baseCurrency})` : null,
                ].filter(Boolean).join('; ')}.
              </span>
            )}
          </span>
          <button className="btn-icon" aria-label="Dismiss import summary" onClick={() => setImportSummary(null)}>
            <X size={14} />
          </button>
        </div>
      )}

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
          <>
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
            {(snapshot.notes?.length ?? 0) > 1800 && (
              <span style={{ display: 'block', textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                {snapshot.notes?.length ?? 0} / 2000
              </span>
            )}
          </>
        )}
      </div>

      {/* Exchange Rate Bar */}
      <ExchangeRateBar
        rates={snapshot.exchangeRates}
        ratesLastUpdated={snapshot.ratesLastUpdated}
        onChange={handleRateChange}
        onRatesRefreshed={handleRatesRefreshed}
        hasForeignItems={hasForeignItems}
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
            <CategorySection
              key={cat.id}
              category={cat}
              exchangeRates={snapshot.exchangeRates}
              snapshotMonth={snapshot.month}
              onChange={handleCategoryChange}
              tags={snapshot.tags ?? []}
              onAssignTags={(itemId, target) => handleAssignTags(cat.id, itemId, target)}
            />
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
            <CategorySection
              key={cat.id}
              category={cat}
              exchangeRates={snapshot.exchangeRates}
              snapshotMonth={snapshot.month}
              onChange={handleCategoryChange}
              tags={snapshot.tags ?? []}
              onAssignTags={(itemId, target) => handleAssignTags(cat.id, itemId, target)}
            />
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
          <span className="summ-label">
            Goals NW
            <InfoTooltip body="Net worth counted toward your goals. Excludes any line items you've marked as excluded from goals (e.g. your primary home), so it can be lower than total net worth." />
          </span>
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
      {tagManagerOpen && (
        <TagManager
          snapshot={snapshot}
          onChange={handleTagsChange}
          onClose={() => setTagManagerOpen(false)}
        />
      )}
    </div>
  );
};
