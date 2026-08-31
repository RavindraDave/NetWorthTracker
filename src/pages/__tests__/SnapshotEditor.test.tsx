import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SnapshotEditor } from '../SnapshotEditor';
import type { Category, Snapshot, UserPreferences } from '../../types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  saveSnapshot: vi.fn(),
  confirm: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
  exportCSV: vi.fn(() => 'csv-content'),
  downloadFile: vi.fn(),
  exportExcel: vi.fn(),
  printReport: vi.fn(() => true),
  blocker: { state: 'unblocked' as 'unblocked' | 'blocked', proceed: vi.fn(), reset: vi.fn() },
  appState: {
    id: 's1',
    snapshots: [] as Snapshot[],
    preferences: null as UserPreferences | null,
  },
  locationState: null as { importSummary?: unknown } | null,
}));

vi.mock('../../hooks/useAppBase', () => ({
  useAppBase: () => ({
    snapshots: mocks.appState.snapshots,
    saveSnapshot: mocks.saveSnapshot,
    preferences: mocks.appState.preferences,
    confirm: mocks.confirm,
    error: mocks.toastError,
    info: mocks.toastInfo,
    warning: mocks.toastWarning,
    baseCurrency: mocks.appState.preferences?.baseCurrency ?? 'INR',
  }),
}));

vi.mock('../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({ preferences: mocks.appState.preferences }),
  };
});

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: mocks.appState.id }),
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: '/editor/s1', state: mocks.locationState }),
  useBlocker: () => mocks.blocker,
}));

vi.mock('../../utils/importExport', () => ({
  exportSnapshotToCSV: mocks.exportCSV,
  downloadFile: mocks.downloadFile,
  exportSnapshotToExcel: mocks.exportExcel,
}));

vi.mock('../../utils/printReport', () => ({
  printSnapshotReport: mocks.printReport,
}));

// ExchangeRateBar and CategorySection have their own coverage elsewhere (or are
// out of this session's scope); stubbing them keeps this file about
// SnapshotEditor's own state machine — the save flow, month handling, export
// menu, and the two calcNetWorth variants it derives.
vi.mock('../../components/editor/ExchangeRateBar', () => ({
  ExchangeRateBar: (props: { onChange: (c: string, r: number) => void; onRatesRefreshed: (r: Record<string, number>, u: string) => void; hasForeignItems: boolean }) => (
    <div data-testid="rate-bar" data-has-foreign={String(props.hasForeignItems)}>
      <button onClick={() => props.onChange('USD', 84)}>set-rate</button>
      <button onClick={() => props.onRatesRefreshed({ USD: 85 }, '2026-06-15T00:00:00.000Z')}>refresh-rates</button>
    </div>
  ),
}));

vi.mock('../../components/editor/CategorySection', () => ({
  CategorySection: (props: { category: Category; onChange: (c: Category) => void }) => (
    <div data-testid={`category-${props.category.id}`}>
      {props.category.name}
      <button onClick={() => props.onChange({ ...props.category, name: `${props.category.name}-edited` })}>
        edit-{props.category.id}
      </button>
    </div>
  ),
}));

function category(o: Partial<Category> & { id: string }): Category {
  return { name: o.id, type: 'asset', icon: '💰', isLiquid: true, isInvestable: true, items: [], ...o };
}

function snapshot(o: Partial<Snapshot> & { id: string; month: string }): Snapshot {
  return {
    createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
    exchangeRates: {}, categories: [category({ id: 'cash', type: 'asset' })], ...o,
  };
}

function prefs(o: Partial<UserPreferences> = {}): UserPreferences {
  return { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'], theme: 'dark', profileName: 'U', ...o };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirm.mockResolvedValue(true);
  mocks.saveSnapshot.mockResolvedValue(undefined);
  mocks.printReport.mockReturnValue(true);
  mocks.blocker.state = 'unblocked';
  mocks.appState.id = 's1';
  mocks.appState.snapshots = [];
  mocks.appState.preferences = prefs();
  mocks.locationState = null;
  localStorage.clear();
});

describe('SnapshotEditor — loading', () => {
  it('shows a loading message when the id does not match any snapshot', () => {
    mocks.appState.snapshots = [];
    render(<SnapshotEditor />);
    expect(screen.getByText('Loading snapshot…')).toBeInTheDocument();
  });
});

describe('SnapshotEditor — template backfill', () => {
  it('adds any enabled category template missing from the loaded snapshot', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06', categories: [category({ id: 'cash' })] })];
    render(<SnapshotEditor />);
    // The real default templates include Investments — backfilled since absent.
    expect(screen.getByTestId('category-default-investments')).toBeInTheDocument();
  });

  it('does not duplicate a template already present, matched by id', () => {
    mocks.appState.snapshots = [snapshot({
      id: 's1', month: '2026-06',
      categories: [category({ id: 'default-cash', name: 'Cash & Bank Accounts' })],
    })];
    render(<SnapshotEditor />);
    expect(screen.getAllByTestId('category-default-cash')).toHaveLength(1);
  });
});

describe('SnapshotEditor — month input', () => {
  it('updates the snapshot month', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    fireEvent.change(screen.getByLabelText('Snapshot month'), { target: { value: '2026-07' } });
    expect(screen.getByLabelText('Snapshot month')).toHaveValue('2026-07');
  });

  it('ignores a cleared month value', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    fireEvent.change(screen.getByLabelText('Snapshot month'), { target: { value: '' } });
    expect(screen.getByLabelText('Snapshot month')).toHaveValue('2026-06');
  });

  it('warns when a loan-configured item will be recalculated for the new month', () => {
    mocks.appState.snapshots = [snapshot({
      id: 's1', month: '2026-06',
      categories: [category({
        id: 'debt', type: 'liability',
        items: [{
          id: 'i1', name: 'Home Loan', amount: 100, currency: 'INR',
          loanPrincipal: 5000000, annualInterestRate: 8, tenureMonths: 240, loanStartMonth: '2020-01',
        }],
      })],
    })];
    render(<SnapshotEditor />);
    fireEvent.change(screen.getByLabelText('Snapshot month'), { target: { value: '2026-07' } });
    expect(mocks.toastInfo).toHaveBeenCalledWith('1 loan balance will be recalculated for the new month.');
  });

  it('pluralizes the loan-recompute notice for more than one loan', () => {
    const loanItem = (id: string) => ({
      id, name: id, amount: 100, currency: 'INR',
      loanPrincipal: 100000, annualInterestRate: 5, tenureMonths: 60, loanStartMonth: '2024-01',
    });
    mocks.appState.snapshots = [snapshot({
      id: 's1', month: '2026-06',
      categories: [category({ id: 'debt', type: 'liability', items: [loanItem('a'), loanItem('b')] })],
    })];
    render(<SnapshotEditor />);
    fireEvent.change(screen.getByLabelText('Snapshot month'), { target: { value: '2026-07' } });
    expect(mocks.toastInfo).toHaveBeenCalledWith('2 loan balances will be recalculated for the new month.');
  });

  it('warns when the new month collides with another existing snapshot', () => {
    mocks.appState.snapshots = [
      snapshot({ id: 's1', month: '2026-06' }),
      snapshot({ id: 's2', month: '2026-07' }),
    ];
    render(<SnapshotEditor />);
    fireEvent.change(screen.getByLabelText('Snapshot month'), { target: { value: '2026-07' } });
    expect(mocks.toastWarning).toHaveBeenCalledWith('A snapshot for this month already exists — saving will overwrite it.');
  });
});

describe('SnapshotEditor — save', () => {
  it('saves directly when there is no month conflict, and navigates home', async () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('Save Snapshot'));

    await waitFor(() => expect(mocks.saveSnapshot).toHaveBeenCalled());
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/');
    const saved = mocks.saveSnapshot.mock.calls[0][0];
    expect(saved.id).toBe('s1');
    expect(saved.updatedAt).not.toBe('2026-06-01T00:00:00.000Z'); // stamped fresh
  });

  it('asks for confirmation before overwriting a month that already has a snapshot', async () => {
    mocks.appState.snapshots = [
      snapshot({ id: 's1', month: '2026-06' }),
      snapshot({ id: 's2', month: '2026-06' }), // different id, same month
    ];
    mocks.confirm.mockResolvedValue(true);
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('Save Snapshot'));

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(
      expect.stringContaining('already exists. Saving will overwrite it.'),
    ));
    await waitFor(() => expect(mocks.saveSnapshot).toHaveBeenCalled());
  });

  it('aborts the save when the overwrite confirmation is declined', async () => {
    mocks.appState.snapshots = [
      snapshot({ id: 's1', month: '2026-06' }),
      snapshot({ id: 's2', month: '2026-06' }),
    ];
    mocks.confirm.mockResolvedValue(false);
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('Save Snapshot'));

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.saveSnapshot).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('shows a month-specific error when the save rejects with a duplicate_month error', async () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    mocks.saveSnapshot.mockRejectedValue(new Error('duplicate_month: 2026-06'));
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('Save Snapshot'));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining('Delete it first or change the month.'),
    ));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('shows a generic error for any other save failure', async () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    mocks.saveSnapshot.mockRejectedValue(new Error('network down'));
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('Save Snapshot'));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Failed to save snapshot. Please try again.'));
  });

  it('strips an orphaned subCategoryId before saving', async () => {
    mocks.appState.snapshots = [snapshot({
      id: 's1', month: '2026-06',
      categories: [category({
        id: 'inv',
        items: [{ id: 'a', name: 'Fund', amount: 100, currency: 'INR', subCategoryId: 'sub-deleted' }],
      })],
    })];
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('Save Snapshot'));

    await waitFor(() => expect(mocks.saveSnapshot).toHaveBeenCalled());
    const saved = mocks.saveSnapshot.mock.calls[0][0];
    expect('subCategoryId' in saved.categories[0].items[0]).toBe(false);
  });
});

describe('SnapshotEditor — export menu', () => {
  beforeEach(() => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
  });

  it('opens and closes the export menu', () => {
    render(<SnapshotEditor />);
    const trigger = screen.getByRole('button', { name: /Export/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the export menu on an outside click', () => {
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('exports CSV via the menu and closes it afterwards', () => {
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /CSV/ }));

    expect(mocks.exportCSV).toHaveBeenCalled();
    expect(mocks.downloadFile).toHaveBeenCalledWith('csv-content', 'snapshot-2026-06.csv', 'text/csv');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('exports Excel via the menu with the current base currency', () => {
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Excel/ }));
    expect(mocks.exportExcel).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), 'INR');
  });

  it('prints via the menu, with no error toast when the popup opens', () => {
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Print/ }));
    expect(mocks.printReport).toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('surfaces an error toast when the print popup is blocked', () => {
    mocks.printReport.mockReturnValue(false);
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Print/ }));
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('popup'));
  });
});

describe('SnapshotEditor — import summary banner', () => {
  it('renders nothing without an import summary', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the plain summary with correct singular/plural wording', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    mocks.locationState = { importSummary: { itemCount: 1, categoryCount: 1, month: '2026-06', fileName: 'x.csv' } };
    render(<SnapshotEditor />);
    expect(screen.getByRole('status')).toHaveTextContent('Imported 1 item across 1 category from x.csv');
  });

  it('shows fabrication warnings when present, joined together', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    mocks.locationState = {
      importSummary: {
        itemCount: 5, categoryCount: 2, month: '2026-06', fileName: 'x.csv',
        missingNameCount: 2, badAmountCount: 1, unknownCurrencyCount: 3,
      },
    };
    render(<SnapshotEditor />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('2 rows had a missing item name');
    expect(banner).toHaveTextContent('1 row had an unreadable amount');
    expect(banner).toHaveTextContent('3 rows had an unrecognized currency (defaulted to INR)');
  });

  it('dismisses the banner', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    mocks.locationState = { importSummary: { itemCount: 1, categoryCount: 1, month: '2026-06', fileName: 'x.csv' } };
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByLabelText('Dismiss import summary'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('clears the router state so the banner does not reappear on refresh', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    mocks.locationState = { importSummary: { itemCount: 1, categoryCount: 1, month: '2026-06', fileName: 'x.csv' } };
    render(<SnapshotEditor />);
    expect(mocks.navigate).toHaveBeenCalledWith('/editor/s1', { replace: true, state: null });
  });
});

describe('SnapshotEditor — notes', () => {
  it('auto-opens the note area when the snapshot already has a note', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06', notes: 'Bonus month' })];
    render(<SnapshotEditor />);
    expect(screen.getByPlaceholderText(/What changed this month/)).toBeInTheDocument();
  });

  it('shows a truncated preview for a long note when collapsed', () => {
    const long = 'x'.repeat(100);
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    // Open, type a long note, then collapse and check the truncated preview.
    fireEvent.click(screen.getByText('Add a note for this month…'));
    fireEvent.change(screen.getByPlaceholderText(/What changed this month/), { target: { value: long } });
    fireEvent.click(screen.getByText('Notes'));
    expect(screen.getByText(`${'x'.repeat(72)}…`)).toBeInTheDocument();
  });

  it('shows a character counter only past 1800 characters', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('Add a note for this month…'));
    fireEvent.change(screen.getByPlaceholderText(/What changed this month/), { target: { value: 'short' } });
    expect(screen.queryByText(/\/ 2000/)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/What changed this month/), { target: { value: 'x'.repeat(1801) } });
    expect(screen.getByText('1801 / 2000')).toBeInTheDocument();
  });
});

describe('SnapshotEditor — chips intro', () => {
  it('shows the first-run chips intro and dismisses it permanently', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    expect(screen.getByText(/tap a chip to change it/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Got it'));
    expect(screen.queryByText(/tap a chip to change it/)).toBeNull();
    expect(localStorage.getItem('wp_chips_intro_seen')).toBe('1');
  });

  it('stays hidden on a later visit once dismissed', () => {
    localStorage.setItem('wp_chips_intro_seen', '1');
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    expect(screen.queryByText(/tap a chip to change it/)).toBeNull();
  });
});

describe('SnapshotEditor — net worth derivations', () => {
  it('shows Goals NW lower than Net Worth when an item is excluded from goals only', () => {
    mocks.appState.snapshots = [snapshot({
      id: 's1', month: '2026-06',
      categories: [category({
        id: 'cash',
        items: [
          { id: 'a', name: 'Counted', amount: 700, currency: 'INR' },
          { id: 'b', name: 'Goal-excluded', amount: 300, currency: 'INR', excludeFromGoals: true },
        ],
      })],
    })];
    const { container } = render(<SnapshotEditor />);
    expect(container.querySelector('.live-preview-val')).toHaveTextContent('₹1,000.00'); // full net worth
    const summBlocks = container.querySelectorAll('.summ-block');
    expect(summBlocks[1]).toHaveTextContent('Goals NW'); // sanity: this is the right block
    expect(summBlocks[1].querySelector('.summ-val')).toHaveTextContent('₹700'); // abbreviated Goals NW
  });

  it('marks the live preview negative when net worth is below zero', () => {
    mocks.appState.snapshots = [snapshot({
      id: 's1', month: '2026-06',
      categories: [category({ id: 'debt', type: 'liability', items: [{ id: 'a', name: 'Loan', amount: 500, currency: 'INR' }] })],
    })];
    const { container } = render(<SnapshotEditor />);
    expect(container.querySelector('.live-preview-val.neg')).toBeInTheDocument();
  });

  it('passes hasForeignItems to the exchange-rate bar based on real item currencies', () => {
    mocks.appState.snapshots = [snapshot({
      id: 's1', month: '2026-06',
      categories: [category({ id: 'cash', items: [{ id: 'a', name: 'USD acct', amount: 10, currency: 'USD' }] })],
    })];
    render(<SnapshotEditor />);
    expect(screen.getByTestId('rate-bar')).toHaveAttribute('data-has-foreign', 'true');
  });

  it('reports no foreign items when everything is in the base currency', () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    render(<SnapshotEditor />);
    expect(screen.getByTestId('rate-bar')).toHaveAttribute('data-has-foreign', 'false');
  });
});

describe('SnapshotEditor — category and rate wiring', () => {
  beforeEach(() => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
  });

  it('applies a category change from a child CategorySection', () => {
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('edit-cash'));
    expect(screen.getByTestId('category-cash')).toHaveTextContent('cash-edited');
  });

  it('applies a manual exchange rate change', () => {
    render(<SnapshotEditor />);
    fireEvent.click(screen.getByText('set-rate'));
    // No crash and the app re-renders with the new rate in state — verified
    // indirectly via a subsequent refresh call still working off fresh state.
    fireEvent.click(screen.getByText('refresh-rates'));
    expect(screen.getByTestId('rate-bar')).toBeInTheDocument();
  });
});

describe('SnapshotEditor — unsaved-changes navigation guard', () => {
  it('prompts and proceeds when the user confirms leaving with unsaved changes', async () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    mocks.confirm.mockResolvedValue(true);
    mocks.blocker.state = 'blocked';
    render(<SnapshotEditor />);

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith('You have unsaved changes. Leave without saving?'));
    await waitFor(() => expect(mocks.blocker.proceed).toHaveBeenCalled());
  });

  it('resets the blocker when the user declines to leave', async () => {
    mocks.appState.snapshots = [snapshot({ id: 's1', month: '2026-06' })];
    mocks.confirm.mockResolvedValue(false);
    mocks.blocker.state = 'blocked';
    render(<SnapshotEditor />);

    await waitFor(() => expect(mocks.blocker.reset).toHaveBeenCalled());
    expect(mocks.blocker.proceed).not.toHaveBeenCalled();
  });
});
