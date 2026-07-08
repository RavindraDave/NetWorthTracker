import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { TEXT, SPACE } from '../common/theme';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { X, Save, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Category, CsvFieldMapping } from '../../types';
import { parseAmount } from '../../utils/numberFormat';
import { useCsvParser, isExcelFile, CSV_FIELDS, CSV_FIELD_HINTS } from '../../hooks/useCsvParser';

/** Returns the first month >= `from` that has no existing snapshot. */
function findNextEmptyMonth(existingMonths: Set<string>, from: string): string {
  let cursor = from;
  for (let i = 0; i < 24; i++) {
    if (!existingMonths.has(cursor)) return cursor;
    const [y, m] = cursor.split('-').map(Number);
    cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return cursor;
}

interface CsvImportModalProps {
  file: File;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ file, onClose }) => {
  const { createNewSnapshot, saveSnapshot, snapshots, preferences } = useApp();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const { headers, rows, parseError, autoDetectMapping, profileNames, applyProfile, saveProfile, deleteProfile } = useCsvParser(file);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [targetMonth, setTargetMonth] = useState(() =>
    findNextEmptyMonth(new Set(snapshots.map(s => s.month)), currentMonth)
  );
  const [mapping, setMapping]               = useState<CsvFieldMapping>({});
  const [importing, setImporting]           = useState(false);
  const [showSaveForm, setShowSaveForm]     = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');

  // Apply auto-detected mapping when the file is first parsed
  useEffect(() => {
    if (headers.length > 0) setMapping(autoDetectMapping());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  const fileKind    = isExcelFile(file) ? 'Excel' : 'CSV';
  const isValid     = !!mapping['Item Name'] && !!mapping['Amount'];
  const monthConflict = snapshots.some(s => s.month === targetMonth);
  const previewRows = rows.slice(0, 5);
  const mappedFields = CSV_FIELDS.filter(f => mapping[f]);

  const handleImport = async () => {
    if (!isValid || importing || monthConflict) return;
    setImporting(true);
    try {
      const baseCurrency = preferences?.baseCurrency ?? 'INR';
      const enabledCurrencies = preferences?.enabledCurrencies ?? [baseCurrency];
      const newSnap = { ...createNewSnapshot(), month: targetMonth };

      for (const row of rows) {
        const itemName = String(row[mapping['Item Name']!] ?? '').trim() || 'Imported Item';
        const catName  = mapping['Category']
          ? (String(row[mapping['Category']] ?? '').trim() || 'Cash & Bank')
          : 'Cash & Bank';
        const amount  = Math.min(Math.abs(parseAmount(String(row[mapping['Amount']!] ?? '0'))), 1e15);
        const rawCurr = mapping['Currency']
          ? String(row[mapping['Currency']] ?? baseCurrency).trim().toUpperCase()
          : baseCurrency;
        const currency = enabledCurrencies.includes(rawCurr) ? rawCurr : baseCurrency;
        const rawType  = mapping['Type']
          ? String(row[mapping['Type']] ?? 'asset').toLowerCase()
          : 'asset';
        const catType: 'asset' | 'liability' = rawType.includes('liab') ? 'liability' : 'asset';

        let targetCat = newSnap.categories.find(
          c => c.name.toLowerCase() === catName.toLowerCase()
        );
        if (!targetCat) {
          const newCat: Category = {
            id: crypto.randomUUID(),
            name: catName,
            type: catType,
            icon: '📦',
            items: [],
            isLiquid: false,
            isInvestable: false,
          };
          newSnap.categories.push(newCat);
          targetCat = newCat;
        }

        targetCat.items.push({
          id: crypto.randomUUID(),
          name: itemName,
          amount,
          currency,
          excludeFromNetWorth: false,
        });
      }

      await saveSnapshot(newSnap);
      const itemCount = newSnap.categories.reduce((sum, c) => sum + c.items.length, 0);
      const categoryCount = newSnap.categories.filter(c => c.items.length > 0).length;
      success(`Imported ${itemCount} items as new snapshot for ${targetMonth}.`);
      onClose();
      navigate(`/editor/${newSnap.id}`, {
        state: {
          importSummary: { itemCount, categoryCount, month: targetMonth, fileName: file.name },
        },
      });
    } catch (err) {
      error('Import failed. Please check the file and try again.');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      aria-label={`Import ${fileKind}`}
      contentStyle={{ maxWidth: 640, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Import {fileKind}</h3>
          <span className="text-muted" style={{ fontSize: TEXT.base, wordBreak: 'break-all' }}>{file.name}</span>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close" style={{ flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      {parseError ? (
        <div style={{ color: 'var(--rose)', fontSize: TEXT.body, marginBottom: SPACE.xl, padding: SPACE.lg, background: 'var(--rose-soft)', borderRadius: 'var(--radius-sm)' }}>
          {parseError}
        </div>
      ) : headers.length === 0 ? (
        <div className="text-muted" style={{ fontSize: TEXT.body, marginBottom: SPACE.xl, textAlign: 'center', padding: SPACE.xl }}>
          Parsing file…
        </div>
      ) : (
        <>
          {/* Month picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.lg, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <label style={{ fontSize: TEXT.md, fontWeight: 500, minWidth: 130 }}>Snapshot Month</label>
            <input
              type="month"
              className="line-item-input"
              value={targetMonth}
              onChange={e => setTargetMonth(e.target.value)}
              style={{ maxWidth: 180 }}
            />
            {monthConflict && (
              <span style={{ fontSize: TEXT.sm, color: 'var(--rose)' }}>
                A snapshot already exists for this month — choose a different month above
              </span>
            )}
          </div>

          {/* Saved mapping profiles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {profileNames.length > 0 && (
              <>
                <span style={{ fontSize: TEXT.sm, color: 'var(--text-3)' }}>Saved mappings:</span>
                {profileNames.map(n => (
                  <span key={n} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'var(--surface-glass, rgba(0,0,0,0.15))',
                    borderRadius: 'var(--radius-sm)', padding: '0.15rem 0.15rem 0.15rem 0.5rem',
                  }}>
                    <button
                      onClick={() => { const m = applyProfile(n); if (m) setMapping(m); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-text)', fontSize: TEXT.smmd, padding: 0 }}
                      title={`Apply mapping "${n}"`}
                    >
                      {n}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => deleteProfile(n)}
                      title={`Delete mapping "${n}"`}
                      aria-label={`Delete mapping ${n}`}
                      style={{ width: 20, height: 20 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {showSaveForm ? (
                <>
                  <input
                    type="text"
                    className="line-item-input"
                    value={profileNameInput}
                    onChange={e => setProfileNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { saveProfile(profileNameInput, mapping); setShowSaveForm(false); setProfileNameInput(''); } }}
                    placeholder="Mapping name"
                    style={{ maxWidth: 160, fontSize: TEXT.base }}
                    aria-label="Name for this mapping"
                    autoFocus
                  />
                  <button className="btn btn-primary" style={{ fontSize: TEXT.sm, padding: '0.3rem 0.6rem' }}
                    onClick={() => { saveProfile(profileNameInput, mapping); setShowSaveForm(false); setProfileNameInput(''); }}
                    disabled={!profileNameInput.trim()}>
                    Save
                  </button>
                  <button className="btn-icon" onClick={() => { setShowSaveForm(false); setProfileNameInput(''); }} aria-label="Cancel">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-outline"
                  style={{ fontSize: TEXT.sm, padding: '0.3rem 0.6rem' }}
                  onClick={() => setShowSaveForm(true)}
                  disabled={!isValid}
                  title={isValid ? 'Save the current column mapping for reuse' : 'Map the required fields first'}
                >
                  <Save size={13} style={{ marginRight: '0.3rem' }} /> Save mapping
                </button>
              )}
            </div>
          </div>

          {/* Column mapping */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: TEXT.sm, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: SPACE.sm }}>
              Column Mapping
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: SPACE.sm }}>
              {CSV_FIELDS.map(field => (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: TEXT.xs, color: 'var(--text-3)' }}>
                    {field}
                    {CSV_FIELD_HINTS[field] === 'required' && (
                      <span style={{ color: 'var(--rose)', marginLeft: 2 }}>*</span>
                    )}
                    {' '}
                    <span style={{ opacity: 0.6 }}>({CSV_FIELD_HINTS[field]})</span>
                  </label>
                  <select
                    className="line-item-select"
                    value={mapping[field] ?? ''}
                    onChange={e => setMapping(prev => ({
                      ...prev,
                      [field]: e.target.value || undefined,
                    }))}
                  >
                    <option value="">— not mapped —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {previewRows.length > 0 && mappedFields.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: TEXT.sm, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: SPACE.sm }}>
                Preview ({Math.min(previewRows.length, 5)} of {rows.length} rows)
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', fontSize: TEXT.sm, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {mappedFields.map(f => (
                        <th key={f} style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-3)', fontWeight: 500, whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.15)' }}>
                          {f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < previewRows.length - 1 ? '1px solid var(--border)' : undefined }}>
                        {mappedFields.map(f => (
                          <td key={f} style={{ padding: '5px 8px', color: 'var(--text-2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(row[mapping[f]!] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
        <span className="text-muted" style={{ fontSize: TEXT.base }}>
          {rows.length > 0 ? `${rows.length} rows detected` : ''}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!isValid || importing || !!parseError || headers.length === 0 || monthConflict}
          >
            {importing ? 'Importing…' : `Import ${rows.length} items`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
