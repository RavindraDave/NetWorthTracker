import { Snapshot, UserPreferences } from '../types';
import { calcNetWorth, convertToBase } from './calculations';
import { resolveNumberLocale } from './currencies';

/** Format a number with the appropriate currency symbol prefix. */
function fmtCurrency(amount: number, currency: string, locale: string): string {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  const prefix = symbols[currency] ?? `${currency} `;
  return `${prefix}${Math.round(amount).toLocaleString(locale)}`;
}

/** Convert YYYY-MM to a human-readable label like "May 2026". */
function monthLabel(month: string): string {
  const [year, mon] = month.split('-');
  const d = new Date(Number(year), Number(mon) - 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
  const savingsRate = income > 0 ? (savings / income * 100).toFixed(1) : '0';
  const hasCashFlow = income > 0;

  const nwColor = netWorth >= 0 ? '#16a34a' : '#dc2626';

  // Build asset section rows
  const assetCats = snapshot.categories.filter(
    cat => cat.type === 'asset' && (categoryTotals[cat.id] ?? 0) > 0
  );
  const liabilityCats = snapshot.categories.filter(
    cat => cat.type === 'liability' && (categoryTotals[cat.id] ?? 0) > 0
  );

  function buildCategoryRows(cats: typeof assetCats): string {
    return cats.map(cat => {
      const catTotal = categoryTotals[cat.id] ?? 0;
      const visibleItems = cat.items.filter(i => !i.excludeFromNetWorth);
      const itemRows = visibleItems.map(item => {
        const baseVal = convertToBase(item.amount, item.currency, baseCurrency, snapshot.exchangeRates);
        return `
        <tr>
          <td style="padding:5px 8px;color:#374151;">${escHtml(item.name)}</td>
          <td style="padding:5px 8px;color:#6b7280;text-align:center;">${escHtml(item.currency)}</td>
          <td style="padding:5px 8px;color:#374151;text-align:right;">${item.amount.toLocaleString(locale)}</td>
          <td style="padding:5px 8px;color:#374151;text-align:right;">${fmtCurrency(baseVal, baseCurrency, locale)}</td>
        </tr>`;
      }).join('');

      return `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f9fafb;border-left:3px solid #10b981;padding:6px 10px;margin-bottom:4px;">
          <span style="font-weight:600;color:#111827;">${escHtml(cat.name)}</span>
          <span style="font-weight:600;color:#111827;">${fmtCurrency(catTotal, baseCurrency, locale)}</span>
        </div>
        ${visibleItems.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
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

  const cashFlowHtml = hasCashFlow ? `
  <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;flex:1;min-width:120px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Income</div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${fmtCurrency(income, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;flex:1;min-width:120px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Expenses</div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${fmtCurrency(expenses, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;flex:1;min-width:120px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Savings</div>
      <div style="font-size:16px;font-weight:600;color:${savings >= 0 ? '#16a34a' : '#dc2626'};">${fmtCurrency(savings, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;flex:1;min-width:120px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Savings Rate</div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${savingsRate}%</div>
    </div>
  </div>` : '';

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
      <div style="font-size:22px;font-weight:700;color:${nwColor};">${fmtCurrency(netWorth, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;flex:1;min-width:140px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Total Assets</div>
      <div style="font-size:22px;font-weight:700;color:#16a34a;">${fmtCurrency(totalAssets, baseCurrency, locale)}</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;flex:1;min-width:140px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Total Liabilities</div>
      <div style="font-size:22px;font-weight:700;color:#dc2626;">${fmtCurrency(totalLiabilities, baseCurrency, locale)}</div>
    </div>
  </div>

  ${cashFlowHtml}

  ${assetCats.length > 0 ? `<h2>Assets</h2>${buildCategoryRows(assetCats)}` : ''}
  ${liabilityCats.length > 0 ? `<h2>Liabilities</h2>${buildCategoryRows(liabilityCats)}` : ''}

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
