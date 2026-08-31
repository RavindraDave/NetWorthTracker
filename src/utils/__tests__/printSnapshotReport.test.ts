import { describe, it, expect, vi, beforeEach } from 'vitest';
import { printSnapshotReport } from '../printReport';
import type { Category, LineItem, Snapshot } from '../../types';

/**
 * `printSnapshotReport`'s own HTML shell — separate from `buildCategoryRows`,
 * which already has its own structural test file. `window.open` is mocked so the
 * generated markup can be inspected without a real popup.
 */

function item(o: Partial<LineItem> & { id: string }): LineItem {
  return { name: `Item ${o.id}`, amount: 1000, currency: 'INR', ...o };
}

function category(o: Partial<Category> & { id: string }): Category {
  return { name: o.id, type: 'asset', icon: '💰', isLiquid: true, isInvestable: true, items: [], ...o };
}

function snapshot(o: Partial<Snapshot> & { id: string; month: string }): Snapshot {
  return { createdAt: '', updatedAt: '', exchangeRates: {}, categories: [], ...o };
}

interface FakeWindow {
  document: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  focus: ReturnType<typeof vi.fn>;
  print: ReturnType<typeof vi.fn>;
}

function makeFakeWindow(): FakeWindow {
  return {
    document: { write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    print: vi.fn(),
  };
}

let fakeWin: FakeWindow | null;

beforeEach(() => {
  fakeWin = makeFakeWindow();
  vi.spyOn(window, 'open').mockImplementation(() => fakeWin as unknown as Window);
});

function printedHtml(): string {
  return fakeWin!.document.write.mock.calls[0][0] as string;
}

describe('printSnapshotReport — popup handling', () => {
  it('returns false and writes nothing when the popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const ok = printSnapshotReport(snapshot({ id: 's1', month: '2026-06' }), 'INR');
    expect(ok).toBe(false);
  });

  it('writes the report, closes the document, focuses and prints the window', () => {
    const ok = printSnapshotReport(snapshot({ id: 's1', month: '2026-06' }), 'INR');
    expect(ok).toBe(true);
    expect(fakeWin!.document.write).toHaveBeenCalledTimes(1);
    expect(fakeWin!.document.close).toHaveBeenCalled();
    expect(fakeWin!.focus).toHaveBeenCalled();
    expect(fakeWin!.print).toHaveBeenCalled();
  });
});

describe('printSnapshotReport — summary and header', () => {
  it('shows the month label, base currency and net worth values', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06',
      categories: [category({ id: 'cash', items: [item({ id: 'a', amount: 5000 })] })],
    }), 'INR');
    const html = printedHtml();
    expect(html).toContain('June 2026');
    expect(html).toContain('All values in INR');
    expect(html).toContain('₹5,000');
  });

  it('colors net worth red when negative', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06',
      categories: [category({ id: 'debt', type: 'liability', items: [item({ id: 'a', amount: 500 })] })],
    }), 'INR');
    expect(printedHtml()).toContain('color:#dc2626;">−₹500');
  });
});

describe('printSnapshotReport — cash flow section', () => {
  it('is omitted when there is no income', () => {
    printSnapshotReport(snapshot({ id: 's1', month: '2026-06' }), 'INR');
    expect(printedHtml()).not.toContain('Savings Rate');
  });

  it('is shown with income, expenses and a computed savings rate', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06', monthlyIncome: 1000, monthlyExpenses: 400,
    }), 'INR');
    const html = printedHtml();
    expect(html).toContain('Savings Rate');
    expect(html).toContain('60.0%');
  });

  it('colors negative savings differently from positive', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06', monthlyIncome: 400, monthlyExpenses: 1000,
    }), 'INR');
    expect(printedHtml()).toContain('color:#dc2626;">\u2212\u20b9600');
  });
});

describe('printSnapshotReport — category sections', () => {
  it('omits the Assets heading when there are no non-empty asset categories', () => {
    printSnapshotReport(snapshot({ id: 's1', month: '2026-06' }), 'INR');
    expect(printedHtml()).not.toContain('<h2>Assets</h2>');
  });

  it('shows Assets and Liabilities headings only for categories that have items', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06',
      categories: [
        category({ id: 'cash', items: [item({ id: 'a' })] }),
        category({ id: 'debt', type: 'liability', items: [item({ id: 'b' })] }),
        category({ id: 'empty-inv' }), // no items — must not render a heading section on its own
      ],
    }), 'INR');
    const html = printedHtml();
    expect(html).toContain('<h2>Assets</h2>');
    expect(html).toContain('<h2>Liabilities</h2>');
  });
});

describe('printSnapshotReport — exchange rates section', () => {
  it('is omitted when every item is in the base currency', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06',
      categories: [category({ id: 'cash', items: [item({ id: 'a', currency: 'INR' })] })],
    }), 'INR');
    expect(printedHtml()).not.toContain('Exchange Rates Used');
  });

  it('lists a foreign currency actually in use, with its rate', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06', exchangeRates: { INR: 83 },
      categories: [category({ id: 'cash', items: [item({ id: 'a', currency: 'USD' })] })],
    }), 'INR');
    const html = printedHtml();
    expect(html).toContain('Exchange Rates Used');
    expect(html).toContain('1 USD =');
    expect(html).toContain('83.0000');
  });

  it('flags a missing rate rather than silently showing 1:1', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06', // no exchangeRates entry for USD
      categories: [category({ id: 'cash', items: [item({ id: 'a', currency: 'USD' })] })],
    }), 'INR');
    expect(printedHtml()).toContain('Not set (treated as 1:1)');
  });

  it('excludes a foreign-currency item that is excluded from net worth', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06',
      categories: [category({ id: 'cash', items: [
        item({ id: 'a', currency: 'INR' }),
        item({ id: 'b', currency: 'USD', excludeFromNetWorth: true }),
      ] })],
    }), 'INR');
    expect(printedHtml()).not.toContain('Exchange Rates Used');
  });

  it('shows the rates-as-of date only when ratesLastUpdated is set', () => {
    printSnapshotReport(snapshot({
      id: 's1', month: '2026-06', exchangeRates: { INR: 83 }, ratesLastUpdated: '2026-06-10T00:00:00.000Z',
      categories: [category({ id: 'cash', items: [item({ id: 'a', currency: 'USD' })] })],
    }), 'INR');
    expect(printedHtml()).toContain('Rates as of');
  });
});

describe('printSnapshotReport — notes', () => {
  it('is omitted with no notes', () => {
    printSnapshotReport(snapshot({ id: 's1', month: '2026-06' }), 'INR');
    expect(printedHtml()).not.toContain('id="Notes"');
  });

  it('renders notes and preserves line breaks via white-space:pre-wrap', () => {
    printSnapshotReport(snapshot({ id: 's1', month: '2026-06', notes: 'Line one\nLine two' }), 'INR');
    const html = printedHtml();
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('Line one\nLine two');
  });

  it('escapes HTML in notes rather than injecting it into the page', () => {
    printSnapshotReport(snapshot({ id: 's1', month: '2026-06', notes: '<img src=x onerror=alert(1)>' }), 'INR');
    const html = printedHtml();
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
