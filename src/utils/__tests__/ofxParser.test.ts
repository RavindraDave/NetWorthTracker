import { describe, it, expect } from 'vitest';
import { parseOfx } from '../ofxParser';

const BANK_OFX = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>0001112222
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260115
<TRNAMT>-42.50
<FITID>1001
<NAME>COFFEE SHOP
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1234.56
<DTASOF>20260131
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const CC_OFX = `
<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTRS>
<CURDEF>USD
<CCACCTFROM>
<ACCTID>4111000011112222
</CCACCTFROM>
<LEDGERBAL>
<BALAMT>-980.25
</LEDGERBAL>
</CCSTMTRS>
</CREDITCARDMSGSRSV1>
</OFX>
`;

const INVEST_OFX = `
<OFX>
<INVSTMTMSGSRSV1>
<INVSTMTTRNRS>
<INVSTMTRS>
<CURDEF>USD
<INVACCTFROM>
<ACCTID>BROKER-9999
</INVACCTFROM>
<INVBAL>
<AVAILCASH>5000.00
<MARGINBALANCE>0.00
</INVBAL>
</INVSTMTRS>
</INVSTMTTRNRS>
</INVSTMTMSGSRSV1>
</OFX>
`;

describe('parseOfx', () => {
  it('extracts a bank account ledger balance as an asset', () => {
    const { rows } = parseOfx(BANK_OFX);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Item Name']).toBe('0001112222');
    expect(rows[0]['Amount']).toBe('1234.56');
    expect(rows[0]['Currency']).toBe('USD');
    expect(rows[0]['Type']).toBe('asset');
  });

  it('extracts a credit card ledger balance as a liability', () => {
    const { rows } = parseOfx(CC_OFX);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Type']).toBe('liability');
    expect(rows[0]['Amount']).toBe('-980.25');
  });

  it('extracts investment account cash as an asset', () => {
    const { rows } = parseOfx(INVEST_OFX);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Item Name']).toBe('BROKER-9999 (cash)');
    expect(rows[0]['Amount']).toBe('5000.00');
    expect(rows[0]['Type']).toBe('asset');
  });

  it('NEVER reads <STMTTRN> transaction data — a bug here cannot leak the ledger', () => {
    // The bank fixture's only transaction is -42.50 at "COFFEE SHOP" — assert
    // that value never appears anywhere in the parsed output.
    const { rows } = parseOfx(BANK_OFX);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('COFFEE SHOP');
    expect(serialized).not.toContain('-42.50');
  });

  it('produces headers matching the CsvImportModal column-mapper contract', () => {
    const { headers } = parseOfx(BANK_OFX);
    expect(headers).toEqual(['Item Name', 'Amount', 'Currency', 'Type']);
  });

  it('returns no rows for a file with no balance tags', () => {
    expect(parseOfx('<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>').rows).toEqual([]);
  });
});
