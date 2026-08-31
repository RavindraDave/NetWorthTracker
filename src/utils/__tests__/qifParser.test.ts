import { describe, it, expect } from 'vitest';
import { parseQif } from '../qifParser';

const SINGLE_ACCOUNT_BANK = `!Type:Bank
D01/05/2026
T-42.50
PCOFFEE SHOP
^
D01/20/2026
T1500.00
PPAYCHECK
^
`;

const MULTI_ACCOUNT = `!Account
NChecking
TBank
^
!Type:Bank
D01/05/2026
T900.00
^
!Account
NVisa Card
TCCard
^
!Type:CCard
D01/10/2026
T-250.00
^
`;

describe('parseQif', () => {
  it('uses the LAST transaction amount as the proxy balance for a single-account file', () => {
    const { rows } = parseQif(SINGLE_ACCOUNT_BANK, 'My Checking');
    expect(rows).toHaveLength(1);
    expect(rows[0]['Item Name']).toBe('My Checking');
    expect(rows[0]['Amount']).toBe('1500.00'); // last T line, not the first
    expect(rows[0]['Type']).toBe('asset');
  });

  it('falls back to the given default name when no !Account block names it', () => {
    const { rows } = parseQif(SINGLE_ACCOUNT_BANK, 'fallback.qif');
    expect(rows[0]['Item Name']).toBe('fallback.qif');
  });

  it('separates multiple accounts by their !Account block name, and classifies CCard as liability', () => {
    const { rows } = parseQif(MULTI_ACCOUNT);
    const byName = Object.fromEntries(rows.map(r => [r['Item Name'], r]));
    expect(byName['Checking']['Amount']).toBe('900.00');
    expect(byName['Checking']['Type']).toBe('asset');
    expect(byName['Visa Card']['Amount']).toBe('-250.00');
    expect(byName['Visa Card']['Type']).toBe('liability');
  });

  it('produces headers matching the CsvImportModal column-mapper contract', () => {
    const { headers } = parseQif(SINGLE_ACCOUNT_BANK);
    expect(headers).toEqual(['Item Name', 'Amount', 'Currency', 'Type']);
  });

  it('returns no rows for a file with no transaction amounts', () => {
    expect(parseQif('!Type:Bank\n^\n').rows).toEqual([]);
  });
});
