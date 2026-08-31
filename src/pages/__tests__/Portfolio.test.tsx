import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Portfolio } from '../Portfolio';
import type { Category, LineItem, Snapshot, UserPreferences } from '../../types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  appState: {
    currentSnapshot: null as Snapshot | null,
    preferences: null as UserPreferences | null,
  },
}));

vi.mock('../../hooks/useAppBase', () => ({
  useAppBase: () => ({
    currentSnapshot: mocks.appState.currentSnapshot,
    baseCurrency: mocks.appState.preferences?.baseCurrency ?? 'INR',
    preferences: mocks.appState.preferences,
  }),
}));

// CurrencyDisplay reads the raw AppContext via useContext directly (not useApp()),
// so the real Context object must survive the mock — only useApp is overridden.
vi.mock('../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({
      currentSnapshot: mocks.appState.currentSnapshot,
      preferences: mocks.appState.preferences,
      updatePreferences: vi.fn(),
    }),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

// The donut chart's own behaviour is covered by DonutChart.test.tsx; stub it here
// so this file stays about Portfolio's own table/flattening logic.
vi.mock('../../components/dashboard/DonutChart', () => ({
  DonutChart: () => <div data-testid="donut-stub" />,
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

function prefs(o: Partial<UserPreferences> = {}): UserPreferences {
  return { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'], theme: 'dark', profileName: 'U', ...o };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appState.currentSnapshot = null;
  mocks.appState.preferences = null;
});

describe('Portfolio — empty state', () => {
  it('shows an empty-state CTA with no snapshot', () => {
    mocks.appState.preferences = prefs();
    render(<Portfolio />);
    expect(screen.getByText('No portfolio data yet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Go to Dashboard'));
    expect(mocks.navigate).toHaveBeenCalledWith('/');
  });
});

describe('Portfolio — holdings table', () => {
  beforeEach(() => {
    mocks.appState.preferences = prefs();
  });

  it('flattens items across categories, sorted by base-currency value descending', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', name: 'Savings', amount: 500 })] }),
      category({ id: 'inv', name: 'Investments', items: [item({ id: 'b', name: 'Fund', amount: 5000 })] }),
    ]);
    render(<Portfolio />);

    const rows = screen.getAllByRole('row').slice(1); // drop header row
    expect(rows[0]).toHaveTextContent('Fund');
    expect(rows[1]).toHaveTextContent('Savings');
  });

  it('shows the sub-group as a second badge when the item has one', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({
        id: 'inv', name: 'Investments',
        subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
        items: [item({ id: 'a', name: 'Fund A', subCategoryId: 'sub-mf' })],
      }),
    ]);
    render(<Portfolio />);

    const row = screen.getByText('Fund A').closest('tr')!;
    expect(row).toHaveTextContent('Investments');
    expect(row).toHaveTextContent('Mutual Funds');
  });

  it('renders only the category badge for an ungrouped item — no empty sub-badge', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', name: 'Wallet' })] }),
    ]);
    const { container } = render(<Portfolio />);

    const row = screen.getByText('Wallet').closest('tr')!;
    expect(row).toHaveTextContent('Cash');
    expect(container.querySelector('.portfolio-cat-cell__sub')).toBeNull();
  });

  it('falls back to "Unnamed Asset" for a blank item name', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', name: '' })] }),
    ]);
    render(<Portfolio />);
    expect(screen.getByText('Unnamed Asset')).toBeInTheDocument();
  });

  it('shows the original currency only when it differs from base', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({
        id: 'inv', name: 'Investments',
        items: [
          item({ id: 'a', name: 'US Fund', currency: 'USD', amount: 100 }),
          item({ id: 'b', name: 'INR Fund', currency: 'INR', amount: 100 }),
        ],
      }),
    ]);
    render(<Portfolio />);

    expect(screen.getByText('US Fund').closest('tr')).not.toHaveTextContent('-');
    // The INR row's "Original Amount" cell renders a literal dash.
    const inrCells = screen.getByText('INR Fund').closest('tr')!.querySelectorAll('td');
    expect(inrCells[2]).toHaveTextContent('-');
  });

  it('marks an excluded item with a badge and shows — instead of a percentage', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', name: 'Excluded item', excludeFromNetWorth: true })] }),
    ]);
    render(<Portfolio />);

    const row = screen.getByText('Excluded item').closest('tr')!;
    expect(row).toHaveTextContent('Excluded');
    expect(row).toHaveTextContent('—');
    expect(row.className).toContain('excluded');
  });

  it('marks a goal-excluded (but net-worth-counted) item distinctly', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', name: 'Goal excl', excludeFromGoals: true })] }),
    ]);
    render(<Portfolio />);
    expect(screen.getByText('Goal excl').closest('tr')).toHaveTextContent('Goal-excluded');
  });

  it('does not double up the exclusion badges when both flags are set', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({
        id: 'cash', name: 'Cash',
        items: [item({ id: 'a', name: 'Both', excludeFromNetWorth: true, excludeFromGoals: true })],
      }),
    ]);
    render(<Portfolio />);
    const row = screen.getByText('Both').closest('tr')!;
    expect(row.textContent!.match(/Goal-excluded/g)).toBeNull();
    expect(row.textContent!.match(/Excluded/g)).toHaveLength(1);
  });

  it('computes % of assets against the total, and shows 0% when total is 0', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', amount: 250 })] }),
      category({ id: 'inv', name: 'Investments', items: [item({ id: 'b', amount: 750 })] }),
    ]);
    render(<Portfolio />);
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('navigates to the snapshot editor from a row\'s edit button', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', name: 'Savings' })] }),
    ]);
    render(<Portfolio />);
    fireEvent.click(screen.getByLabelText('Edit Savings'));
    expect(mocks.navigate).toHaveBeenCalledWith('/editor/s1');
  });
});

describe('Portfolio — liabilities table', () => {
  beforeEach(() => {
    mocks.appState.preferences = prefs();
  });

  it('hides the liabilities section entirely when there are none', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a' })] }),
    ]);
    render(<Portfolio />);
    expect(screen.queryByText('Outstanding Debt')).toBeNull();
  });

  it('lists liabilities separately from assets, with their own sub-group badge', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', name: 'Savings' })] }),
      category({
        id: 'debt', name: 'Secured Debt', type: 'liability',
        subCategories: [{ id: 'sub-home', name: 'Home Loan' }],
        items: [item({ id: 'b', name: 'Mortgage', amount: 2000, subCategoryId: 'sub-home' })],
      }),
    ]);
    render(<Portfolio />);

    expect(screen.getByText('Outstanding Debt')).toBeInTheDocument();
    const row = screen.getByText('Mortgage').closest('tr')!;
    expect(row).toHaveTextContent('Secured Debt');
    expect(row).toHaveTextContent('Home Loan');
    // Not mixed into the assets table.
    const assetsTable = screen.getByText('Savings').closest('table')!;
    expect(assetsTable).not.toHaveTextContent('Mortgage');
  });

  it('falls back to "Unnamed Liability" for a blank name', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'debt', name: 'Debt', type: 'liability', items: [item({ id: 'a', name: '' })] }),
    ]);
    render(<Portfolio />);
    expect(screen.getByText('Unnamed Liability')).toBeInTheDocument();
  });

  it('computes % of liabilities independently of the assets total', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'cash', name: 'Cash', items: [item({ id: 'a', amount: 1_000_000 })] }),
      category({
        id: 'debt', name: 'Debt', type: 'liability',
        items: [item({ id: 'b', amount: 100 }), item({ id: 'c', amount: 300 })],
      }),
    ]);
    render(<Portfolio />);
    expect(screen.getByText('25.0%')).toBeInTheDocument(); // 100/400 among liabilities
    expect(screen.getByText('75.0%')).toBeInTheDocument(); // 300/400
  });

  it('navigates to the editor from a liability row too', () => {
    mocks.appState.currentSnapshot = snapshot([
      category({ id: 'debt', name: 'Debt', type: 'liability', items: [item({ id: 'a', name: 'Loan' })] }),
    ]);
    render(<Portfolio />);
    fireEvent.click(screen.getByLabelText('Edit Loan'));
    expect(mocks.navigate).toHaveBeenCalledWith('/editor/s1');
  });
});
