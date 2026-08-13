import { Snapshot, UserPreferences, Category, LineItem } from '../types';
import { calcNetWorth, convertToBase, calcSavingsRate, anchorRate } from './calculations';
import { resolveNumberLocale, formatCurrency } from './currencies';
import { groupItemsBySubCategory } from './subCategories';

/** Format a summary/aggregate amount — whole numbers, no cents. */
function fmtSummary(amount: number, currency: string, locale: string): string {
  return formatCurrency(amount, currency, { locale, precision: 0 });
}

/** Format a line-item amount — 2 decimal places for consistent width. */
function fmtItem(amount: number, currency: string, locale: string): string {
  return formatCurrency(amount, currency, { locale, precision: 2 });
}

/** Convert YYYY-MM to a human-readable label like "May 2026". */
function monthLabel(month: string): string {
  const [year, mon] = month.split('-');
  const d = new Date(Number(year), Number(mon) - 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Everything `buildCategoryRows` needs that isn't the category list itself. */
export interface CategoryRowsContext {
  categoryTotals: Record<string, number>;
  snapshot: Snapshot;
  baseCurrency: string;
  locale: string;
}

/**
 * Render one bordered block per category: a header strip with the category total,
 * then a fixed-layout table of its included line items.
 *
 * Module-level and pure so the table structure can be unit-tested — a colgroup
 * misalignment shipped from this function once, and `window.print()` fires
 * immediately, so the HTML is never seen during a normal UX pass.
 *
 * The 50/10/20/20 colgroup with `table-layout:fixed` is load-bearing: it is what
 * keeps columns aligned across categories with differing content widths. Never
 * nest a table inside a cell here — that reintroduces `table-layout:auto`.
 */
export function buildCategoryRows(cats: Category[], ctx: CategoryRowsContext): string {
  const { categoryTotals, snapshot, baseCurrency, locale } = ctx;
  return cats.map(cat => {
    const catTotal = categoryTotals[cat.id] ?? 0;
    const visibleItems = cat.items.filter(i => !i.excludeFromNetWorth);

    const itemRow = (item: LineItem, indented: boolean) => {
      const baseVal = convertToBase(item.amount, item.currency, baseCurrency, snapshot.exchangeRates);
      // Indent via padding on the first cell only. The colgroup fixes the column
      // width, so the indent eats into the cell rather than shifting the columns.
      const namePad = indented ? '5px 8px 5px 28px' : '5px 8px';
      return `
        <tr>
          <td style="padding:${namePad};color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(item.name)}</td>
          <td style="padding:5px 8px;color:#6b7280;text-align:center;">${escHtml(item.currency)}</td>
          <td style="padding:5px 8px;color:#374151;text-align:right;white-space:nowrap;">${fmtItem(item.amount, item.currency, locale)}</td>
          <td style="padding:5px 8px;color:#374151;text-align:right;white-space:nowrap;">${fmtSummary(baseVal, baseCurrency, locale)}</td>
        </tr>`;
    };

    /**
     * Group headers are ordinary rows spanning the first three columns — NOT a
     * nested table. Nesting a table inside a cell would reintroduce
     * `table-layout:auto` and misalign every category block against the others.
     */
    const groupHeaderRow = (name: string, total: number) => `
        <tr>
          <td colspan="3" style="padding:5px 8px;font-weight:600;color:#374151;background:#fafafa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(name)}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:600;color:#374151;background:#fafafa;white-space:nowrap;">${fmtSummary(total, baseCurrency, locale)}</td>
        </tr>`;

    const groups = groupItemsBySubCategory(cat, baseCurrency, snapshot.exchangeRates);
    const namedGroups = groups.filter(g => g.id !== null);

    let itemRows: string;
    if (namedGroups.length === 0) {
      itemRows = visibleItems.map(item => itemRow(item, false)).join('');
    } else {
      itemRows = groups.map(group => {
        const rows = group.items.filter(i => !i.excludeFromNetWorth);
        if (rows.length === 0) return '';
        // Ungrouped items print under "Other" only because named groups exist to
        // contrast against; with no groups at all they'd print bare (branch above).
        const header = groupHeaderRow(group.id === null ? 'Other' : group.name, group.total);
        return header + rows.map(item => itemRow(item, true)).join('');
      }).join('');
    }

    return `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f9fafb;border-left:3px solid #10b981;padding:6px 10px;margin-bottom:4px;">
          <span style="font-weight:600;color:#111827;">${escHtml(cat.name)}</span>
          <span style="font-weight:600;color:#111827;">${fmtSummary(catTotal, baseCurrency, locale)}</span>
        </div>
        ${visibleItems.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">
          <colgroup>
            <col style="width:50%;" />
            <col style="width:10%;" />
            <col style="width:20%;" />
            <col style="width:20%;" />
          </colgroup>
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:4px 8px;text-align:left;color:#6b7280;font-weight:500;">Item</th>
              <th style="padding:4px 8px;text-align:center;color:#6b7280;font-weight:500;">Currency</th>
              <th style="padding:4px 8px;text-align:right;color:#6b7280;font-weight:500;">Amount</th>
              <th style="padding:4px 8px;text-align:right;color:#6b7280;font-weight:500;">Value (${escHtml(baseCurrency)})</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>` : '<p style="font-size:12px;color:#9ca3af;margin:4px 8px;">No items in this category.</p>'}
      </div>`;
  }).join('');
}

/**
 * Open the snapshot as a print-ready HTML report in a new browser window
 * and immediately trigger the print dialog.
 */
export function printSnapshotReport(snapshot: Snapshot, baseCurrency: string, numberFormat?: UserPreferences['numberFormat']): void {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return; // popup blocked — fail silently

  const locale = resolveNumberLocale(baseCurrency, numberFormat);
  const { totalAssets, totalLiabilities, netWorth, categoryTotals } = calcNetWorth(snapshot, baseCurrency);
  const label = monthLabel(snapshot.month);
  const generatedDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const income = snapshot.monthlyIncome ?? 0;
  const expenses = snapshot.monthlyExpenses ?? 0;
  const savings = income - expenses;
  const savingsRate = calcSavingsRate(income, expenses).toFixed(1);
  const hasCashFlow = income > 0;

  const nwColor = netWorth >= 0 ? '#16a34a' : '#dc2626';

  // Build asset section rows
  const assetCats = snapshot.categories.filter(
    cat => cat.type === 'asset' && (categoryTotals[cat.id] ?? 0) > 0
  );
  const liabilityCats = snapshot.categories.filter(
    cat => cat.type === 'liability' && (categoryTotals[cat.id] ?? 0) > 0
  );

  const rowsCtx: CategoryRowsContext = { categoryTotals, snapshot, baseCurrency, locale };

  const cashFlowHtml = hasCashFlow ? `
  <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;flex:1;min-width:120px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Income</div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${fmtSummary(income, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;flex:1;min-width:120px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Expenses</div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${fmtSummary(expenses, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;flex:1;min-width:120px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Savings</div>
      <div style="font-size:16px;font-weight:600;color:${savings >= 0 ? '#16a34a' : '#dc2626'};">${fmtSummary(savings, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;flex:1;min-width:120px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Savings Rate</div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${savingsRate}%</div>
    </div>
  </div>` : '';

  // Collect non-base currencies actually used in line items
  const usedForeignCurrencies = Array.from(
    new Set(
      snapshot.categories.flatMap(cat =>
        cat.items
          .filter(i => !i.excludeFromNetWorth && i.currency !== baseCurrency)
          .map(i => i.currency)
      )
    )
  ).sort();

  const exchangeRatesHtml = usedForeignCurrencies.length > 0 ? (() => {
    const ratesUpdated = snapshot.ratesLastUpdated
      ? new Date(snapshot.ratesLastUpdated).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    const rates = snapshot.exchangeRates ?? {};
    const baseRate = anchorRate(baseCurrency, rates);
    const rateRows = usedForeignCurrencies.map(currency => {
      const currRate = anchorRate(currency, rates);
      const displayRate = baseRate > 0 && currRate > 0 ? baseRate / currRate : 0;
      const rateStr = displayRate > 0
        ? formatCurrency(displayRate, baseCurrency, { locale, precision: 4 })
        : '<span style="color:#dc2626;">Not set (treated as 1:1)</span>';
      return `
        <tr>
          <td style="padding:4px 10px;color:#374151;font-family:monospace;font-size:12px;">${escHtml(currency)}</td>
          <td style="padding:4px 10px;color:#374151;font-size:12px;">1 ${escHtml(currency)} = ${rateStr}</td>
        </tr>`;
    }).join('');

    return `
  <div style="margin-top:20px;padding:14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:.05em;">Exchange Rates Used</div>
      ${ratesUpdated ? `<div style="font-size:11px;color:#6b7280;">Rates as of ${escHtml(ratesUpdated)}</div>` : ''}
    </div>
    <table style="border-collapse:collapse;">
      <tbody>${rateRows}</tbody>
    </table>
  </div>`;
  })() : '';

  const notesHtml = snapshot.notes ? `
  <div style="margin-top:24px;padding:14px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;">
    <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Notes</div>
    <p style="margin:0;font-size:13px;color:#78350f;white-space:pre-wrap;">${escHtml(snapshot.notes)}</p>
  </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WealthPulse — ${escHtml(label)}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 20px 28px;
    }
    h1 { margin: 0 0 2px; font-size: 20px; font-weight: 700; color: #111827; }
    h2 { margin: 20px 0 10px; font-size: 15px; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .subtitle { font-size: 13px; color: #6b7280; margin: 0 0 20px; }
    table { border-collapse: collapse; width: 100%; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <h1>WealthPulse — Net Worth Report</h1>
  <p class="subtitle">${escHtml(label)} &nbsp;·&nbsp; Generated ${escHtml(generatedDate)}</p>

  <!-- Summary grid -->
  <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;flex:1;min-width:140px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Net Worth</div>
      <div style="font-size:22px;font-weight:700;color:${nwColor};">${fmtSummary(netWorth, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;flex:1;min-width:140px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Total Assets</div>
      <div style="font-size:22px;font-weight:700;color:#16a34a;">${fmtSummary(totalAssets, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;flex:1;min-width:140px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Total Liabilities</div>
      <div style="font-size:22px;font-weight:700;color:#dc2626;">${fmtSummary(totalLiabilities, baseCurrency, locale)}</div>
    </div>
  </div>

  ${cashFlowHtml}

  ${assetCats.length > 0 ? `<h2>Assets</h2>${buildCategoryRows(assetCats, rowsCtx)}` : ''}
  ${liabilityCats.length > 0 ? `<h2>Liabilities</h2>${buildCategoryRows(liabilityCats, rowsCtx)}` : ''}

  ${exchangeRatesHtml}
  ${notesHtml}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
    <span style="font-size:11px;color:#9ca3af;">WealthPulse &middot; ${escHtml(label)} &middot; All values in ${escHtml(baseCurrency)}</span>
    <a href="https://r2dsolutions.com" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:6px;text-decoration:none;opacity:0.6;">
      <img src="https://extensions.r2dsolutions.com/logo.png" alt="R2DSolutions" style="width:14px;height:14px;border-radius:3px;object-fit:contain;" />
      <span style="font-size:11px;color:#6b7280;font-weight:500;">R2DSolutions</span>
    </a>
  </div>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

/** Escape HTML special characters to prevent injection. */
function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
