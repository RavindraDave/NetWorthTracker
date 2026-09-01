/**
 * Applies parsed import rows (from CSV, Excel, OFX, or QIF — anything that's
 * gone through the `{headers, rows}` contract in `useCsvParser.ts`) onto a
 * snapshot. Used for both "add as new snapshot" and "update existing month":
 * the two modes differ only in which snapshot the caller passes in — this
 * function itself has no mode flag, because the behaviour naturally falls
 * out of what's already in that snapshot's categories.
 *
 * Matching rule, deliberately narrow: within a row's resolved category, a
 * case-insensitive name match against an existing item is an UPDATE —
 * amount and currency change, nothing else (id, tags, sub-category, notes,
 * cost-basis/loan fields are all left exactly as they were, even if this
 * row's mapping would produce a different sub-category). No match is an
 * INSERT, built the same way the import path always has. An item that
 * exists but matches no row is never touched, let alone removed — this
 * function only ever adds or updates, never deletes.
 *
 * Pure: never mutates `baseSnapshot` or anything reachable from it, so a
 * caller can safely pass a live snapshot straight from app state purely to
 * preview what WOULD happen, with nothing persisted.
 */
import { Category, CsvFieldMapping, Snapshot } from '../types';
import { parseAmount } from './numberFormat';
import { findSubCategoryIdByName } from './subCategories';

export interface ImportRowSummary {
  updatedCount: number;
  insertedCount: number;
  missingNameCount: number;
  badAmountCount: number;
  unknownCurrencyCount: number;
}

export interface ApplyImportRowsResult {
  snapshot: Snapshot;
  /** One entry per input row, same order — what the preview's Action column reads. */
  rowActions: ('updated' | 'inserted')[];
  summary: ImportRowSummary;
}

export interface ApplyImportRowsOptions {
  enabledCurrencies: string[];
  baseCurrency: string;
}

export function applyImportRows(
  baseSnapshot: Snapshot,
  rows: Record<string, string>[],
  mapping: CsvFieldMapping,
  opts: ApplyImportRowsOptions,
): ApplyImportRowsResult {
  // One level of cloning is enough: every category and its items array gets
  // a fresh copy up front, and every mutation below reassigns rather than
  // pushes/edits in place, so nothing in `baseSnapshot` is ever touched.
  const categories: Category[] = baseSnapshot.categories.map(c => ({ ...c, items: [...c.items] }));

  const rowActions: ('updated' | 'inserted')[] = [];
  let missingNameCount = 0;
  let badAmountCount = 0;
  let unknownCurrencyCount = 0;
  let updatedCount = 0;
  let insertedCount = 0;

  for (const row of rows) {
    const rawName = String(row[mapping['Item Name']!] ?? '').trim();
    if (!rawName) missingNameCount++;
    const itemName = rawName || 'Imported Item';

    const catName = mapping['Category']
      ? (String(row[mapping['Category']] ?? '').trim() || 'Cash & Bank')
      : 'Cash & Bank';

    const rawAmount = String(row[mapping['Amount']!] ?? '0').trim();
    const strippedAmount = rawAmount.replace(/[^\d.,-]/g, '');
    if (rawAmount && (!strippedAmount || strippedAmount === '-')) badAmountCount++;
    const amount = Math.min(Math.abs(parseAmount(rawAmount)), 1e15);

    const rawCurr = mapping['Currency']
      ? String(row[mapping['Currency']] ?? opts.baseCurrency).trim().toUpperCase()
      : opts.baseCurrency;
    const currency = opts.enabledCurrencies.includes(rawCurr) ? rawCurr : opts.baseCurrency;
    if (mapping['Currency'] && rawCurr && currency !== rawCurr) unknownCurrencyCount++;

    const rawType = mapping['Type']
      ? String(row[mapping['Type']] ?? 'asset').toLowerCase()
      : 'asset';
    const catType: 'asset' | 'liability' = rawType.includes('liab') ? 'liability' : 'asset';

    let catIdx = categories.findIndex(c => c.name.toLowerCase() === catName.toLowerCase());
    if (catIdx === -1) {
      categories.push({
        id: crypto.randomUUID(), name: catName, type: catType, icon: '📦',
        items: [], isLiquid: false, isInvestable: false,
      });
      catIdx = categories.length - 1;
    }
    let targetCat = categories[catIdx];

    let subCategoryId: string | undefined;
    const subName = mapping['Sub-Category'] ? String(row[mapping['Sub-Category']] ?? '').trim() : '';
    if (subName) {
      subCategoryId = findSubCategoryIdByName(targetCat, subName);
      if (!subCategoryId) {
        subCategoryId = crypto.randomUUID();
        targetCat = { ...targetCat, subCategories: [...(targetCat.subCategories ?? []), { id: subCategoryId, name: subName }] };
        categories[catIdx] = targetCat;
      }
    }

    const notes = mapping['Notes'] ? String(row[mapping['Notes']] ?? '').trim() || undefined : undefined;

    const existingIdx = rawName
      ? targetCat.items.findIndex(i => i.name.toLowerCase() === rawName.toLowerCase())
      : -1;

    if (existingIdx >= 0) {
      const items = targetCat.items.map((item, idx) => idx === existingIdx ? { ...item, amount, currency } : item);
      categories[catIdx] = { ...targetCat, items };
      updatedCount++;
      rowActions.push('updated');
    } else {
      const newItem = {
        id: crypto.randomUUID(),
        name: itemName,
        amount,
        currency,
        excludeFromNetWorth: false,
        ...(subCategoryId ? { subCategoryId } : {}),
        ...(notes ? { notes } : {}),
      };
      categories[catIdx] = { ...targetCat, items: [...targetCat.items, newItem] };
      insertedCount++;
      rowActions.push('inserted');
    }
  }

  return {
    snapshot: { ...baseSnapshot, categories },
    rowActions,
    summary: { updatedCount, insertedCount, missingNameCount, badAmountCount, unknownCurrencyCount },
  };
}
