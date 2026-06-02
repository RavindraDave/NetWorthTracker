import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Category } from '../../types';

type CsvField = 'Item Name' | 'Category' | 'Amount' | 'Currency' | 'Type';
type FieldMapping = Partial<Record<CsvField, string>>;

const FIELDS: CsvField[] = ['Item Name', 'Category', 'Amount', 'Currency', 'Type'];

const FIELD_ALIASES: Record<CsvField, string[]> = {
  'Item Name': ['itemname', 'name', 'assetname', 'description', 'desc', 'item', 'particulars', 'narration'],
  'Category':  ['category', 'cat', 'group', 'section', 'accounttype', 'accountcategory'],
  'Amount':    ['amount', 'value', 'balance', 'closingbalance', 'amt', 'currentvalue', 'marketvalue'],
  'Currency':  ['currency', 'ccy', 'curr', 'currencycode', 'iso'],
  'Type':      ['type', 'assettype', 'liabilitytype', 'kind', 'assetliability'],
};

const FIELD_HINTS: Record<CsvField, string> = {
  'Item Name': 'required',
  'Category':  'optional',
  'Amount':    'required',
  'Currency':  'optional',
  'Type':      'optional',
};

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_()\-.]/g, '');
}

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

function autoDetect(headers: string[]): FieldMapping {
  const result: FieldMapping = {};
  for (const field of FIELDS) {
    const match = headers.find(h => FIELD_ALIASES[field].includes(normalize(h)));
    if (match) result[field] = match;
  }
  return result;
}

interface CsvImportModalProps {
  file: File;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ file, onClose }) => {
  const { createNewSnapshot, saveSnapshot, snapshots, preferences } = useApp();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [targetMonth, setTargetMonth] = useState(() =>
    findNextEmptyMonth(new Set(snapshots.map(s => s.month)), currentMonth)
  );
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File is too large (max 5 MB). Export a smaller date range and try again.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const wb = XLSX.read(text, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        if (rows.length === 0) { setParseError('No data rows found in this file.'); return; }
        const hdrs = Object.keys(rows[0]).filter(h => !h.startsWith('__EMPTY') && !DANGEROUS_KEYS.has(h.toLowerCase()));
        setHeaders(hdrs);
        setMapping(autoDetect(hdrs));
        setAllRows(rows);
      } catch {
        setParseError('Could not parse this file. Make sure it is a valid CSV.');
      }
    };
    reader.onerror = () => setParseError('Could not read file.');
    reader.readAsText(file);
  }, [file]);

  const isValid = !!mapping['Item Name'] && !!mapping['Amount'];
  const monthConflict = snapshots.some(s => s.month === targetMonth);
  const previewRows = allRows.slice(0, 5);
  const mappedFields = FIELDS.filter(f => mapping[f]);

  const handleImport = async () => {
    if (!isValid || importing || monthConflict) return;
    setImporting(true);
    try {
      const baseCurrency = preferences?.baseCurrency ?? 'INR';
      const enabledCurrencies = preferences?.enabledCurrencies ?? [baseCurrency];
      const newSnap = { ...createNewSnapshot(), month: targetMonth };

      for (const row of allRows) {
        const itemName = String(row[mapping['Item Name']!] ?? '').trim() || 'Imported Item';
        const catName  = mapping['Category']
          ? (String(row[mapping['Category']] ?? '').trim() || 'Cash & Bank')
          : 'Cash & Bank';
        const amtStr  = String(row[mapping['Amount']!] ?? '0').replace(/[^\d.\-]/g, '');
        const rawAmt  = parseFloat(amtStr);
        const amount  = Math.min(Math.abs(Number.isFinite(rawAmt) ? rawAmt : 0), 1e15);
        const rawCurr = mapping['Currency']
          ? String(row[mapping['Currency']] ?? baseCurrency).trim().toUpperCase()
          : baseCurrency;
        const currency = enabledCurrencies.includes(rawCurr) ? rawCurr : baseCurrency;
        const rawType = mapping['Type']
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
      success(`Imported ${allRows.length} items as new snapshot for ${targetMonth}.`);
      onClose();
      navigate(`/editor/${newSnap.id}`);
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
      aria-label="Import CSV"
      contentStyle={{ maxWidth: 640, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Import CSV</h3>
          <span className="text-muted" style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{file.name}</span>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close" style={{ flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      {parseError ? (
        <div style={{ color: 'var(--rose)', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--rose-soft)', borderRadius: 'var(--radius-sm)' }}>
          {parseError}
        </div>
      ) : headers.length === 0 ? (
        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center', padding: '1rem' }}>
          Parsing file…
        </div>
      ) : (
        <>
          {/* Month picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, minWidth: 130 }}>Snapshot Month</label>
            <input
              type="month"
              className="line-item-input"
              value={targetMonth}
              onChange={e => setTargetMonth(e.target.value)}
              style={{ maxWidth: 180 }}
            />
            {monthConflict && (
              <span style={{ fontSize: '0.75rem', color: 'var(--rose)' }}>
                A snapshot already exists for this month — choose a different month above
              </span>
            )}
          </div>

          {/* Column mapping */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: '0.5rem' }}>
              Column Mapping
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
              {FIELDS.map(field => (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                    {field}
                    {FIELD_HINTS[field] === 'required' && (
                      <span style={{ color: 'var(--rose)', marginLeft: 2 }}>*</span>
                    )}
                    {' '}
                    <span style={{ opacity: 0.6 }}>({FIELD_HINTS[field]})</span>
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
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: '0.5rem' }}>
                Preview ({Math.min(previewRows.length, 5)} of {allRows.length} rows)
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
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
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
          {allRows.length > 0 ? `${allRows.length} rows detected` : ''}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!isValid || importing || !!parseError || headers.length === 0 || monthConflict}
          >
            {importing ? 'Importing…' : `Import ${allRows.length} items`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
