/**
 * Hand-rolled QIF balance parser. Emits the same `{headers, rows}` shape as
 * `ofxParser.ts` and `useCsvParser.ts`, so it reuses `CsvImportModal`
 * unchanged.
 *
 * ponytail: QIF has no first-class "current balance" tag — this takes the
 * LAST transaction amount (`T`/`U` line) within each account section as a
 * proxy balance. Upgrade if a cleaner heuristic surfaces from real
 * bank/Quicken exports (e.g. a running total kept alongside).
 */

export interface ParsedRows {
  headers: string[];
  rows: Record<string, string>[];
}

const HEADERS = ['Item Name', 'Amount', 'Currency', 'Type'];

function typeForSection(section: string): 'asset' | 'liability' {
  const s = section.toLowerCase();
  return s.includes('ccard') || s.includes('oth l') ? 'liability' : 'asset';
}

export function parseQif(text: string, defaultName = 'Imported Account'): ParsedRows {
  const accounts = new Map<string, { name: string; type: 'asset' | 'liability'; lastAmount?: string }>();

  let currentSection = '';
  let currentAccountName = defaultName;
  let pendingAmount: string | undefined;

  const commit = () => {
    if (pendingAmount === undefined || pendingAmount === '') return;
    accounts.set(currentAccountName, {
      name: currentAccountName,
      type: typeForSection(currentSection),
      lastAmount: pendingAmount,
    });
    pendingAmount = undefined;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('!Account')) {
      // Reset so the account-list entry's N<name> line (below) is read as
      // THIS account's name, not mistaken for a transaction field.
      currentSection = '';
      continue;
    }
    if (line.startsWith('!Type:')) {
      currentSection = line.slice('!Type:'.length).trim();
      continue;
    }
    if (line.startsWith('N') && currentSection === '') {
      currentAccountName = line.slice(1).trim() || defaultName;
      continue;
    }
    if (line.startsWith('T') || line.startsWith('U')) {
      pendingAmount = line.slice(1).trim();
      continue;
    }
    if (line === '^') {
      commit();
      continue;
    }
  }
  commit(); // a file with no trailing '^' still has one pending record

  const rows = Array.from(accounts.values())
    .filter(a => a.lastAmount)
    .map(a => ({
      'Item Name': a.name,
      'Amount': a.lastAmount!,
      'Currency': '',
      'Type': a.type,
    }));

  return { headers: HEADERS, rows };
}
