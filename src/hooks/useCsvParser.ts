import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { CsvFieldName, CsvFieldMapping } from '../types';

type CsvField = CsvFieldName;

export const CSV_FIELDS: CsvField[] = ['Item Name', 'Category', 'Amount', 'Currency', 'Type', 'Notes'];

export const CSV_FIELD_HINTS: Record<CsvField, string> = {
  'Item Name': 'required',
  'Category':  'optional',
  'Amount':    'required',
  'Currency':  'optional',
  'Type':      'optional',
  'Notes':     'optional',
};

const FIELD_ALIASES: Record<CsvField, string[]> = {
  'Item Name': ['itemname', 'name', 'assetname', 'description', 'desc', 'item', 'particulars', 'narration'],
  'Category':  ['category', 'cat', 'group', 'section', 'accounttype', 'accountcategory'],
  'Amount':    ['amount', 'value', 'balance', 'closingbalance', 'amt', 'currentvalue', 'marketvalue'],
  'Currency':  ['currency', 'ccy', 'curr', 'currencycode', 'iso'],
  'Type':      ['type', 'assettype', 'liabilitytype', 'kind', 'assetliability'],
  'Notes':     ['notes', 'note', 'comment', 'comments', 'remarks'],
};

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** True when the file is an Excel workbook rather than a text CSV. */
export function isExcelFile(file: File): boolean {
  return /\.xlsx?$/i.test(file.name)
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || file.type === 'application/vnd.ms-excel';
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_()\-.]/g, '');
}

export function autoDetect(headers: string[]): CsvFieldMapping {
  const result: CsvFieldMapping = {};
  for (const field of CSV_FIELDS) {
    const match = headers.find(h => FIELD_ALIASES[field].includes(normalize(h)));
    if (match) result[field] = match;
  }
  return result;
}

export function useCsvParser(file: File) {
  const { preferences, updatePreferences } = useApp();
  const { success } = useToast();

  const [headers, setHeaders]     = useState<string[]>([]);
  const [rows, setRows]           = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File is too large (max 5 MB). Export a smaller date range and try again.');
      return;
    }
    const excel = isExcelFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Excel workbooks are binary and must be read as an ArrayBuffer;
        // CSVs are plain text. XLSX.read handles both given the right type.
        const wb = excel
          ? XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' })
          : XLSX.read(e.target?.result as string, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        if (parsed.length === 0) { setParseError('No data rows found in this file.'); return; }
        const hdrs = Object.keys(parsed[0]).filter(
          h => !h.startsWith('__EMPTY') && !DANGEROUS_KEYS.has(h.toLowerCase())
        );
        // Excel sheets commonly carry fully-blank trailing rows — drop them so they
        // don't become "Imported Item" line items with a zero amount.
        const nonBlankRows = parsed.filter(row => hdrs.some(h => String(row[h] ?? '').trim() !== ''));
        setHeaders(hdrs);
        setRows(nonBlankRows);
      } catch {
        setParseError('Could not parse this file. Make sure it is a valid CSV or Excel file.');
      }
    };
    reader.onerror = () => setParseError('Could not read file.');
    if (excel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  }, [file]);

  const autoDetectMapping = (hdrs: string[] = headers): CsvFieldMapping => autoDetect(hdrs);

  const savedProfiles = preferences?.csvMappingProfiles ?? {};
  const profileNames  = Object.keys(savedProfiles);

  const applyProfile = (name: string): CsvFieldMapping | null => {
    const profile = savedProfiles[name];
    if (!profile) return null;
    const filtered: CsvFieldMapping = {};
    for (const field of CSV_FIELDS) {
      const col = profile[field];
      if (col && headers.includes(col)) filtered[field] = col;
    }
    return filtered;
  };

  const saveProfile = async (name: string, mapping: CsvFieldMapping) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updatePreferences({ csvMappingProfiles: { ...savedProfiles, [trimmed]: mapping } });
    success(`Mapping "${trimmed}" saved.`);
  };

  const deleteProfile = async (name: string) => {
    const next = { ...savedProfiles };
    delete next[name];
    await updatePreferences({ csvMappingProfiles: next });
    success(`Mapping "${name}" removed.`);
  };

  return {
    headers,
    rows,
    parseError,
    autoDetectMapping,
    savedProfiles,
    profileNames,
    applyProfile,
    saveProfile,
    deleteProfile,
  };
}
