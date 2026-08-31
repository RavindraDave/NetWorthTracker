/**
 * Hand-rolled OFX balance parser — no dependency added, matching the
 * project's posture (`xlsx` is the one deliberate heavy exception already
 * present). Emits the exact `{headers, rows}` shape `useCsvParser.ts` already
 * produces for CSV/Excel, so `CsvImportModal`'s column-mapper, preview table,
 * and import logic run completely unchanged.
 *
 * Structural guardrail, not just discipline: this NEVER scans `<STMTTRN>`
 * (the transaction list) — only balance tags are ever matched. A bug here
 * cannot leak transaction-level data into an app that has and will have no
 * transaction ledger.
 *
 * Scope cut, documented rather than silently half-done: per-holding
 * investment positions (`<POSSTOCK>`/`<POSMF>`) are NOT parsed. OFX's SGML
 * dialect commonly leaves these tags unclosed, so reliable block extraction
 * without a real OFX grammar is too risky for a net-worth figure. Only
 * account-level totals are read: bank/credit-card ledger balance
 * (`<LEDGERBAL><BALAMT>`) and investment-account cash (`<INVBAL><AVAILCASH>`).
 * Add position parsing if a real export needs finer granularity.
 */

export interface ParsedRows {
  headers: string[];
  rows: Record<string, string>[];
}

const HEADERS = ['Item Name', 'Amount', 'Currency', 'Type'];

/** Works for both OFX SGML (unclosed tags, one per line) and OFX 2.x XML
 *  (closed tags) — either way the value ends at the next `<`. */
function lastTagValueBefore(text: string, tag: string, beforeIndex: number): string | undefined {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'gi');
  let match: RegExpExecArray | null;
  let last: string | undefined;
  const scope = text.slice(0, beforeIndex);
  while ((match = re.exec(scope))) last = match[1].trim();
  return last;
}

function lastTagIndexBefore(text: string, tag: string, beforeIndex: number): number {
  const idx = text.slice(0, beforeIndex).toUpperCase().lastIndexOf(`<${tag.toUpperCase()}>`);
  return idx;
}

export function parseOfx(text: string): ParsedRows {
  const rows: Record<string, string>[] = [];

  // Bank / credit-card accounts: <LEDGERBAL><BALAMT>value. Whichever of
  // BANKACCTFROM/CCACCTFROM occurs closer before the match decides asset vs
  // liability — a credit card ledger balance is money owed, not held.
  const ledgerRe = /<LEDGERBAL>[\s\S]{0,80}?<BALAMT>([^<\r\n]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = ledgerRe.exec(text))) {
    const amount = m[1].trim();
    if (!amount) continue;
    const acctId = lastTagValueBefore(text, 'ACCTID', m.index) ?? 'Imported Account';
    const currency = lastTagValueBefore(text, 'CURDEF', m.index);
    const isCreditCard = lastTagIndexBefore(text, 'CCACCTFROM', m.index) > lastTagIndexBefore(text, 'BANKACCTFROM', m.index);
    rows.push({
      'Item Name': acctId,
      'Amount': amount,
      'Currency': currency ?? '',
      'Type': isCreditCard ? 'liability' : 'asset',
    });
  }

  // Investment accounts: <INVBAL>...<AVAILCASH>value — account-level cash only.
  const invCashRe = /<INVBAL>[\s\S]{0,300}?<AVAILCASH>([^<\r\n]*)/gi;
  while ((m = invCashRe.exec(text))) {
    const amount = m[1].trim();
    if (!amount) continue;
    const acctId = lastTagValueBefore(text, 'ACCTID', m.index) ?? 'Imported Investment Account';
    const currency = lastTagValueBefore(text, 'CURDEF', m.index);
    rows.push({
      'Item Name': `${acctId} (cash)`,
      'Amount': amount,
      'Currency': currency ?? '',
      'Type': 'asset',
    });
  }

  return { headers: HEADERS, rows };
}
