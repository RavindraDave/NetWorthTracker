import { describe, it, expect } from 'vitest';
import { normalize, autoDetect, CSV_FIELDS, CSV_FIELD_HINTS } from '../useCsvParser';

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

describe('normalize', () => {
  it('lowercases the string', () => {
    expect(normalize('ItemName')).toBe('itemname');
  });

  it('strips spaces', () => {
    expect(normalize('Item Name')).toBe('itemname');
  });

  it('strips underscores', () => {
    expect(normalize('item_name')).toBe('itemname');
  });

  it('strips parentheses', () => {
    expect(normalize('amount(USD)')).toBe('amountusd');
  });

  it('strips hyphens', () => {
    expect(normalize('closing-balance')).toBe('closingbalance');
  });

  it('strips dots', () => {
    expect(normalize('curr.code')).toBe('currcode');
  });

  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// autoDetect
// ---------------------------------------------------------------------------

describe('autoDetect', () => {
  it('detects "Item Name" from "name" header', () => {
    const mapping = autoDetect(['name', 'amount']);
    expect(mapping['Item Name']).toBe('name');
  });

  it('detects "Amount" from "balance" header', () => {
    const mapping = autoDetect(['description', 'balance']);
    expect(mapping['Amount']).toBe('balance');
  });

  it('detects "Currency" from "ccy" header', () => {
    const mapping = autoDetect(['item', 'value', 'ccy']);
    expect(mapping['Currency']).toBe('ccy');
  });

  it('detects "Category" from "group" header', () => {
    const mapping = autoDetect(['item', 'amount', 'group']);
    expect(mapping['Category']).toBe('group');
  });

  it('detects "Type" from "type" header', () => {
    const mapping = autoDetect(['name', 'amt', 'type']);
    expect(mapping['Type']).toBe('type');
  });

  it('ignores unrecognised headers', () => {
    const mapping = autoDetect(['foo', 'bar', 'baz']);
    expect(Object.keys(mapping)).toHaveLength(0);
  });

  it('detects multiple fields at once', () => {
    const headers = ['description', 'currentvalue', 'currencycode', 'category', 'kind'];
    const mapping = autoDetect(headers);
    expect(mapping['Item Name']).toBe('description');
    expect(mapping['Amount']).toBe('currentvalue');
    expect(mapping['Currency']).toBe('currencycode');
    expect(mapping['Category']).toBe('category');
    expect(mapping['Type']).toBe('kind');
  });

  it('returns empty mapping for empty headers', () => {
    expect(autoDetect([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// CSV_FIELDS / CSV_FIELD_HINTS
// ---------------------------------------------------------------------------

describe('CSV_FIELDS', () => {
  it('contains the five expected field names', () => {
    expect(CSV_FIELDS).toEqual(['Item Name', 'Category', 'Amount', 'Currency', 'Type']);
  });
});

describe('CSV_FIELD_HINTS', () => {
  it('marks Item Name and Amount as required', () => {
    expect(CSV_FIELD_HINTS['Item Name']).toBe('required');
    expect(CSV_FIELD_HINTS['Amount']).toBe('required');
  });

  it('marks Category, Currency, and Type as optional', () => {
    expect(CSV_FIELD_HINTS['Category']).toBe('optional');
    expect(CSV_FIELD_HINTS['Currency']).toBe('optional');
    expect(CSV_FIELD_HINTS['Type']).toBe('optional');
  });
});
