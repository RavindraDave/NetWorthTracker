import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DonutChart } from '../DonutChart';
import type { Category, LineItem, Snapshot } from '../../../types';

// recharts needs real layout (ResponsiveContainer measures its container) which
// jsdom doesn't provide. Rendering children directly is enough to exercise the
// component's own logic — DonutChart's behaviour lives in what data it computes
// and which legend rows/cells it wires a click handler to, not in the SVG itself.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ data }: { data: unknown[] }) => <div data-testid="pie-slices" data-count={data.length} />,
  Cell: () => null,
  Tooltip: () => null,
}));

const mocks = vi.hoisted(() => ({
  snapshot: null as Snapshot | null,
}));

vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({
    currentSnapshot: mocks.snapshot,
    preferences: { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'] },
  }),
}));

function item(o: Partial<LineItem> & { id: string }): LineItem {
  return { name: `Item ${o.id}`, amount: 1000, currency: 'INR', ...o };
}

function category(o: Partial<Category> & { id: string }): Category {
  return {
    name: o.id, type: 'asset', icon: '💰', isLiquid: true, isInvestable: true, items: [], ...o,
  };
}

function snapshot(categories: Category[]): Snapshot {
  return {
    id: 's1', month: '2026-06', createdAt: '', updatedAt: '',
    exchangeRates: { USD: 83 }, categories,
  };
}

beforeEach(() => {
  mocks.snapshot = null;
});

describe('DonutChart — empty and basic states', () => {
  it('shows an empty state with no snapshot', () => {
    mocks.snapshot = null;
    render(<DonutChart />);
    expect(screen.getByText('No asset data yet')).toBeInTheDocument();
  });

  it('shows an empty state when every category totals zero', () => {
    mocks.snapshot = snapshot([category({ id: 'cash', items: [] })]);
    render(<DonutChart />);
    expect(screen.getByText('No asset data yet')).toBeInTheDocument();
  });

  it('renders one legend row per category with a positive value', () => {
    mocks.snapshot = snapshot([
      category({ id: 'cash', items: [item({ id: 'a', amount: 1000 })] }),
      category({ id: 'inv', items: [item({ id: 'b', amount: 2000 })] }),
    ]);
    render(<DonutChart />);
    expect(screen.getByText('cash')).toBeInTheDocument();
    expect(screen.getByText('inv')).toBeInTheDocument();
    expect(screen.getByText('By category')).toBeInTheDocument();
  });

  it('excludes liability categories from the asset allocation', () => {
    mocks.snapshot = snapshot([
      category({ id: 'cash', items: [item({ id: 'a', amount: 1000 })] }),
      category({ id: 'debt', type: 'liability', items: [item({ id: 'b', amount: 500 })] }),
    ]);
    render(<DonutChart />);
    expect(screen.getByText('cash')).toBeInTheDocument();
    expect(screen.queryByText('debt')).toBeNull();
  });
});

describe('DonutChart — currency toggle', () => {
  it('hides the toggle with only one currency in use', () => {
    mocks.snapshot = snapshot([category({ id: 'cash', items: [item({ id: 'a', amount: 1000, currency: 'INR' })] })]);
    render(<DonutChart />);
    expect(screen.queryByRole('group', { name: 'Allocation view' })).toBeNull();
  });

  it('shows the toggle and switches views with 2+ currencies', () => {
    mocks.snapshot = snapshot([category({
      id: 'cash',
      items: [item({ id: 'a', amount: 1000, currency: 'INR' }), item({ id: 'b', amount: 100, currency: 'USD' })],
    })]);
    render(<DonutChart />);

    expect(screen.getByRole('group', { name: 'Allocation view' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Currency' }));
    expect(screen.getByText('By denomination')).toBeInTheDocument();
    expect(screen.getByText('INR')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });
});

describe('DonutChart — drill-down', () => {
  const withGroups = () => snapshot([
    category({
      id: 'inv', name: 'Investments',
      subCategories: [
        { id: 'sub-mf', name: 'Mutual Funds' },
        { id: 'sub-stocks', name: 'Stocks' },
      ],
      items: [
        item({ id: 'a', amount: 3000, subCategoryId: 'sub-mf' }),
        item({ id: 'b', amount: 1000, subCategoryId: 'sub-stocks' }),
      ],
    }),
    category({ id: 'cash', name: 'Cash', items: [item({ id: 'c', amount: 500 })] }),
  ]);

  it('only offers the drill affordance on a category that has groups', () => {
    mocks.snapshot = withGroups();
    render(<DonutChart />);

    expect(screen.getByLabelText('Break down Investments by sub-group')).toBeInTheDocument();
    expect(screen.queryByLabelText('Break down Cash by sub-group')).toBeNull();
  });

  it('drills into a category and shows its sub-group split with a breadcrumb', () => {
    mocks.snapshot = withGroups();
    render(<DonutChart />);

    fireEvent.click(screen.getByLabelText('Break down Investments by sub-group'));

    expect(screen.getByText('Investments')).toBeInTheDocument(); // breadcrumb current
    expect(screen.getByText('% of Investments')).toBeInTheDocument();
    expect(screen.getByText('Mutual Funds')).toBeInTheDocument();
    expect(screen.getByText('Stocks')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument(); // 3000 / 4000
  });

  it('returns to the top-level view via the breadcrumb close button', () => {
    mocks.snapshot = withGroups();
    render(<DonutChart />);

    fireEvent.click(screen.getByLabelText('Break down Investments by sub-group'));
    fireEvent.click(screen.getByLabelText('Back to all categories'));

    expect(screen.getByText('By category')).toBeInTheDocument();
    expect(screen.queryByText('% of Investments')).toBeNull();
  });

  it('hides the currency toggle while drilled in', () => {
    mocks.snapshot = snapshot([
      category({
        id: 'inv', name: 'Investments',
        subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
        items: [
          item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf', currency: 'INR' }),
          item({ id: 'b', amount: 100, currency: 'USD' }),
        ],
      }),
    ]);
    render(<DonutChart />);
    fireEvent.click(screen.getByLabelText('Break down Investments by sub-group'));
    expect(screen.queryByRole('group', { name: 'Allocation view' })).toBeNull();
  });

  /**
   * A category whose only items are excluded from net worth has zero visible
   * value, so it never reaches the legend at all — there is no "drillable but
   * shows nothing" state to land in. Confirms the invariant `drillableIds` relies
   * on: a category can't be visible with zero value.
   */
  it('a category with only excluded items disappears entirely rather than becoming a dead drill target', () => {
    mocks.snapshot = snapshot([
      category({
        id: 'inv', name: 'Investments',
        subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
        items: [item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf', excludeFromNetWorth: true })],
      }),
      // A second category with real value, so the chart itself isn't empty.
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'b', amount: 500 })] }),
    ]);
    render(<DonutChart />);

    expect(screen.queryByText('Investments')).toBeNull();
    expect(screen.queryByLabelText('Break down Investments by sub-group')).toBeNull();
    expect(screen.getByText('Cash')).toBeInTheDocument();
  });

  it('drilling always shows at least one slice for any category the legend offers to drill', () => {
    // A category whose items are split across exclusion state and grouping —
    // exercising the general case, not a hand-picked "it happens to work" one.
    mocks.snapshot = snapshot([
      category({
        id: 'inv', name: 'Investments',
        subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
        items: [
          item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf' }),
          item({ id: 'b', amount: 9999, excludeFromNetWorth: true }), // excluded, ungrouped
        ],
      }),
    ]);
    render(<DonutChart />);

    fireEvent.click(screen.getByLabelText('Break down Investments by sub-group'));
    expect(screen.getByText('Mutual Funds')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('leaves the drill-down automatically if the category loses its groups underneath it', () => {
    mocks.snapshot = withGroups();
    const { rerender } = render(<DonutChart />);
    fireEvent.click(screen.getByLabelText('Break down Investments by sub-group'));
    expect(screen.getByText('% of Investments')).toBeInTheDocument();

    // Simulate the snapshot changing (groups removed) and re-render.
    mocks.snapshot = snapshot([category({ id: 'inv', name: 'Investments', items: [item({ id: 'a', amount: 3000 })] })]);
    rerender(<DonutChart />);

    expect(screen.queryByText('% of Investments')).toBeNull();
    expect(screen.getByText('By category')).toBeInTheDocument();
  });
});

describe('DonutChart — truncation cue', () => {
  function manyCategories(n: number): Snapshot {
    return snapshot(
      Array.from({ length: n }, (_, i) =>
        category({ id: `cat${i}`, name: `Cat ${i}`, items: [item({ id: `i${i}`, amount: (n - i) * 100 })] })),
    );
  }

  it('shows no "+N more" with 9 or fewer categories', () => {
    mocks.snapshot = manyCategories(9);
    render(<DonutChart />);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('shows "+N more" once there are more than 9 categories', () => {
    mocks.snapshot = manyCategories(12);
    render(<DonutChart />);
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('never shows "+N more" while drilled in — the sub-view folds its own tail', () => {
    const subs = Array.from({ length: 11 }, (_, i) => ({ id: `s${i}`, name: `Fund ${i}` }));
    mocks.snapshot = snapshot([
      category({
        id: 'inv', name: 'Investments', subCategories: subs,
        items: subs.map((s, i) => item({ id: `i${i}`, amount: (11 - i) * 10, subCategoryId: s.id })),
      }),
    ]);
    render(<DonutChart />);
    fireEvent.click(screen.getByLabelText('Break down Investments by sub-group'));
    expect(screen.queryByText(/more$/)).toBeNull();
    expect(screen.getByText('Other (3)')).toBeInTheDocument();
  });
});
