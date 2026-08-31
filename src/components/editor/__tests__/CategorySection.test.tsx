import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CategorySection } from '../CategorySection';
import type { Category, LineItem } from '../../../types';

vi.mock('../CategorySection.css', () => ({}));
vi.mock('../SubCategoryGroupHeader.css', () => ({}));
vi.mock('../LineItemRow.css', () => ({}));
vi.mock('../AddItemRow.css', () => ({}));
vi.mock('../../common/InclusionChips.css', () => ({}));
vi.mock('../../common/CurrencyDisplay', () => ({
  CurrencyDisplay: ({ amount, currency }: { amount: number; currency: string }) => (
    <span data-testid="amount">{currency} {Math.round(amount)}</span>
  ),
}));

const confirmMock = vi.fn(() => Promise.resolve(true));

// Mutable so the "missing preferences" test can null it out for one render.
const appBasePrefs: { current: { baseCurrency: string; enabledCurrencies: string[] } | undefined } = {
  current: { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'] },
};

// LineItemRow reaches for the toast context (loan-recompute notice), so the
// provider has to be stubbed even though these tests never assert on a toast.
vi.mock('../../common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), confirm: confirmMock }),
}));

vi.mock('../../../hooks/useAppBase', () => ({
  useAppBase: () => ({
    preferences: appBasePrefs.current,
    confirm: confirmMock,
  }),
}));

vi.mock('../../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({ preferences: { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'] } }),
  };
});

function item(overrides: Partial<LineItem> & { id: string }): LineItem {
  return { name: `Item ${overrides.id}`, amount: 1000, currency: 'INR', ...overrides };
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'default-investments',
    name: 'Investments',
    type: 'asset',
    icon: '📈',
    isLiquid: true,
    isInvestable: true,
    items: [],
    ...overrides,
  };
}

const baseProps = {
  exchangeRates: { USD: 83 },
  snapshotMonth: '2026-06',
};

beforeEach(() => {
  vi.clearAllMocks();
  appBasePrefs.current = { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD'] };
});

// ---------------------------------------------------------------------------
// The zero-change path
// ---------------------------------------------------------------------------

describe('CategorySection without sub-categories', () => {
  it('renders no group chrome at all', () => {
    const { container } = render(
      <CategorySection
        {...baseProps}
        category={category({ items: [item({ id: 'a' })] })}
        onChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.subcat-group')).toBeNull();
    expect(container.querySelector('.subcat-header')).toBeNull();
    expect(screen.queryByText('Ungrouped')).toBeNull();
  });

  it('keeps the unsuffixed add-item labels that existing selectors rely on', () => {
    render(
      <CategorySection {...baseProps} category={category()} onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('New item name')).toBeInTheDocument();
    expect(screen.getByLabelText('Add item')).toBeInTheDocument();
  });

  it('opens the picker rather than adding every suggestion at once', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={category()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add suggested sub-groups to Investments'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds only the picked groups, with their descriptions, in one onChange', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={category()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add suggested sub-groups to Investments'));
    fireEvent.click(screen.getByLabelText('Mutual Funds'));
    fireEvent.click(screen.getByLabelText('Bonds'));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 groups' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0].subCategories;
    expect(added.map((s: { name: string }) => s.name)).toEqual(['Mutual Funds', 'Bonds']);
    expect(added[0].description).toMatch(/schemes/i);
  });

  it('offers no suggestions for a category we have no opinion about', () => {
    render(
      <CategorySection
        {...baseProps}
        category={category({ id: crypto.randomUUID(), name: 'My Custom Category' })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/Add suggested sub-groups/)).toBeNull();
  });

  it('now covers the categories that previously had no suggestions', () => {
    render(
      <CategorySection
        {...baseProps}
        category={category({ id: 'default-business', name: 'Business' })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Add suggested sub-groups to Business')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Grouped rendering
// ---------------------------------------------------------------------------

describe('CategorySection with sub-categories', () => {
  const grouped = () => category({
    subCategories: [
      { id: 'sub-mf', name: 'Mutual Funds' },
      { id: 'sub-stocks', name: 'Stocks' },
    ],
    items: [
      item({ id: 'a', amount: 1000, subCategoryId: 'sub-mf' }),
      item({ id: 'b', amount: 2000, subCategoryId: 'sub-mf' }),
      item({ id: 'c', amount: 500 }),
    ],
  });

  /** Group names also appear as <option>s in every row picker, so scope to headers. */
  const headerNames = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.subcat-header__name')).map(el => el.textContent);

  it('renders a header and subtotal per group, plus an Ungrouped bucket', () => {
    const { container } = render(
      <CategorySection {...baseProps} category={grouped()} onChange={vi.fn()} />,
    );

    expect(headerNames(container)).toEqual(['Mutual Funds', 'Stocks', 'Ungrouped']);
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('shows empty groups so they can be filled', () => {
    const { container } = render(
      <CategorySection {...baseProps} category={grouped()} onChange={vi.fn()} />,
    );
    // Mutual Funds (2), Stocks (0), Ungrouped (1)
    expect(container.querySelectorAll('.subcat-group')).toHaveLength(3);
  });

  it('gives each named group its own suffixed add row', () => {
    render(<CategorySection {...baseProps} category={grouped()} onChange={vi.fn()} />);

    expect(screen.getByLabelText('New item name in Mutual Funds')).toBeInTheDocument();
    expect(screen.getByLabelText('Add item to Mutual Funds')).toBeInTheDocument();
    // The ungrouped bucket keeps the plain labels.
    expect(screen.getByLabelText('New item name')).toBeInTheDocument();
  });

  it('files an item added from a group into that group', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('New item name in Stocks'), {
      target: { value: 'Reliance' },
    });
    fireEvent.click(screen.getByLabelText('Add item to Stocks'));

    const added = onChange.mock.calls[0][0].items.find((i: LineItem) => i.name === 'Reliance');
    expect(added.subCategoryId).toBe('sub-stocks');
  });

  it('adds an ungrouped item with no subCategoryId', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('New item name'), { target: { value: 'Loose cash' } });
    fireEvent.click(screen.getByLabelText('Add item'));

    const added = onChange.mock.calls[0][0].items.find((i: LineItem) => i.name === 'Loose cash');
    expect('subCategoryId' in added).toBe(false);
  });

  it('collapses a group but keeps its header and subtotal visible', () => {
    const { container } = render(
      <CategorySection {...baseProps} category={grouped()} onChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByLabelText('Collapse Mutual Funds'));

    expect(screen.queryByLabelText('New item name in Mutual Funds')).toBeNull();
    expect(headerNames(container)).toContain('Mutual Funds');
    expect(screen.getByLabelText('Expand Mutual Funds')).toBeInTheDocument();
  });

  it('moves an item between groups via the row picker', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CategorySection {...baseProps} category={grouped()} onChange={onChange} />,
    );

    const picker = within(container).getByLabelText('Group for Item a');
    fireEvent.change(picker, { target: { value: 'sub-stocks' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const moved = onChange.mock.calls[0][0].items.find((i: LineItem) => i.id === 'a');
    expect(moved.subCategoryId).toBe('sub-stocks');
  });

  it('ungroups an item and drops the key rather than setting undefined', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Group for Item a'), { target: { value: '__none__' } });

    const ungroupedItem = onChange.mock.calls[0][0].items.find((i: LineItem) => i.id === 'a');
    expect('subCategoryId' in ungroupedItem).toBe(false);
  });

  /**
   * The footgun this feature has to survive: creating a group and assigning an item
   * to it are two mutations of the same `category` prop. If they were dispatched as
   * two `onChange` calls in one tick, both would read the same stale category and the
   * second would drop the new definition.
   */
  it('creates and assigns a new group in exactly ONE onChange', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Group for Item c'), { target: { value: '__new__' } });
    fireEvent.change(screen.getByLabelText('New group for Item c'), {
      target: { value: 'Bonds' },
    });
    fireEvent.keyDown(screen.getByLabelText('New group for Item c'), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);

    const next: Category = onChange.mock.calls[0][0];
    const bonds = next.subCategories!.find(s => s.name === 'Bonds');
    expect(bonds).toBeDefined();
    // Both halves of the mutation are present in the same payload.
    expect(next.items.find(i => i.id === 'c')!.subCategoryId).toBe(bonds!.id);
  });

  it('converges on an existing group when the typed name only differs by case', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Group for Item c'), { target: { value: '__new__' } });
    fireEvent.change(screen.getByLabelText('New group for Item c'), {
      target: { value: '  mutual   FUNDS ' },
    });
    fireEvent.keyDown(screen.getByLabelText('New group for Item c'), { key: 'Enter' });

    const next: Category = onChange.mock.calls[0][0];
    expect(next.subCategories).toHaveLength(2); // no duplicate created
    expect(next.items.find(i => i.id === 'c')!.subCategoryId).toBe('sub-mf');
  });

  it('hints that an existing group will be reused before committing', () => {
    render(<CategorySection {...baseProps} category={grouped()} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Group for Item c'), { target: { value: '__new__' } });
    fireEvent.change(screen.getByLabelText('New group for Item c'), {
      target: { value: 'mutual funds' },
    });

    expect(screen.getByText(/Using existing/)).toBeInTheDocument();
  });

  it('shows an orphaned reference as ungrouped rather than blank', () => {
    const cat = category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
      items: [item({ id: 'ghost', subCategoryId: 'sub-deleted' })],
    });

    render(<CategorySection {...baseProps} category={cat} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Group for Item ghost')).toHaveValue('__none__');
  });

  it('adds a group from the category footer', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add a sub-group to Investments'));
    const input = screen.getByLabelText('New sub-group in Investments');
    fireEvent.change(input, { target: { value: 'Bonds' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange.mock.calls[0][0].subCategories).toHaveLength(3);
  });

  it('does not create a duplicate group from the footer', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add a sub-group to Investments'));
    const input = screen.getByLabelText('New sub-group in Investments');
    fireEvent.change(input, { target: { value: 'STOCKS' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renames a group in place', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename group Mutual Funds'));
    const input = screen.getByLabelText('Rename Mutual Funds');
    fireEvent.change(input, { target: { value: 'MF Portfolio' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange.mock.calls[0][0].subCategories[0].name).toBe('MF Portfolio');
  });

  it('reorders a group from the options menu', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Options for group Stocks'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Move up/ }));

    expect(onChange.mock.calls[0][0].subCategories.map((s: { id: string }) => s.id))
      .toEqual(['sub-stocks', 'sub-mf']);
  });

  it('merges a group into a sibling from the options menu', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Options for group Stocks'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mutual Funds' }));

    const next: Category = onChange.mock.calls[0][0];
    expect(next.subCategories).toHaveLength(1);
    expect(next.items).toHaveLength(3); // nothing lost
  });

  it('deletes an empty group without asking for confirmation', async () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Options for group Stocks'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete group/ }));

    expect(confirmMock).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0].subCategories).toHaveLength(1);
  });

  it('confirms before deleting a group with items, and keeps every item', async () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Options for group Mutual Funds'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete group/ }));

    expect(confirmMock).toHaveBeenCalledWith(
      expect.stringContaining('nothing is deleted'),
      'destructive',
    );

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    const next: Category = onChange.mock.calls[0][0];
    expect(next.items).toHaveLength(3);
    expect(next.items.filter(i => i.subCategoryId === 'sub-mf')).toHaveLength(0);
  });

  it('does not delete a group with items when the user declines the confirmation', async () => {
    confirmMock.mockResolvedValueOnce(false);
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Options for group Mutual Funds'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete group/ }));

    await vi.waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses singular wording when exactly one item would move to Ungrouped', async () => {
    const onChange = vi.fn();
    const cat = category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }, { id: 'sub-stocks', name: 'Stocks' }],
      items: [item({ id: 'a', subCategoryId: 'sub-mf' })],
    });
    render(<CategorySection {...baseProps} category={cat} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Options for group Mutual Funds'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete group/ }));

    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining('1 item moves'), 'destructive');
  });

  it('edits an item field through the row and folds it into the category onChange', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.change(screen.getByDisplayValue('Item a'), { target: { value: 'Renamed fund' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0].items.find((i: LineItem) => i.id === 'a');
    expect(updated.name).toBe('Renamed fund');
  });

  it('removes an item through the row and folds it into the category onChange', async () => {
    confirmMock.mockResolvedValueOnce(true);
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole('button', { name: /remove item/i })[0]);

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0].items.some((i: LineItem) => i.id === 'a')).toBe(false);
  });

  it('re-expands a collapsed group', () => {
    render(<CategorySection {...baseProps} category={grouped()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Collapse Mutual Funds'));
    expect(screen.queryByLabelText('New item name in Mutual Funds')).toBeNull();
    fireEvent.click(screen.getByLabelText('Expand Mutual Funds'));
    expect(screen.getByLabelText('New item name in Mutual Funds')).toBeInTheDocument();
  });

  it('discards the footer group-name draft on Escape without creating a group', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add a sub-group to Investments'));
    const input = screen.getByLabelText('New sub-group in Investments');
    fireEvent.change(input, { target: { value: 'Discard me' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('New sub-group in Investments')).toBeNull();
  });

  it('creates no group when the footer input is committed blank', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add a sub-group to Investments'));
    const input = screen.getByLabelText('New sub-group in Investments');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores an ordinary keystroke in the footer group-name input', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Add a sub-group to Investments'));
    const input = screen.getByLabelText('New sub-group in Investments');
    fireEvent.change(input, { target: { value: 'Sti' } });
    fireEvent.keyDown(input, { key: 'a' });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New sub-group in Investments')).toBeInTheDocument();
  });

  it('offers to merge when a rename collides with an existing group name, and merges on confirm', async () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename group Mutual Funds'));
    fireEvent.change(screen.getByLabelText('Rename Mutual Funds'), { target: { value: 'Stocks' } });
    fireEvent.keyDown(screen.getByLabelText('Rename Mutual Funds'), { key: 'Enter' });

    await vi.waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining('Merge this group into it?')));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    const next: Category = onChange.mock.calls[0][0];
    expect(next.subCategories).toHaveLength(1); // merged down to one
  });

  it('leaves both groups intact when the user declines the merge', async () => {
    confirmMock.mockResolvedValueOnce(false);
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={grouped()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename group Mutual Funds'));
    fireEvent.change(screen.getByLabelText('Rename Mutual Funds'), { target: { value: 'Stocks' } });
    fireEvent.keyDown(screen.getByLabelText('Rename Mutual Funds'), { key: 'Enter' });

    await vi.waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Category-level chrome: collapse, liability styling, exclusion counts
// ---------------------------------------------------------------------------

describe('CategorySection — category header', () => {
  it('collapses and re-expands the whole category on header click', () => {
    render(
      <CategorySection {...baseProps} category={category({ items: [item({ id: 'a' })] })} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('New item name')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Investments'));
    expect(screen.queryByLabelText('New item name')).toBeNull();

    fireEvent.click(screen.getByText('Investments'));
    expect(screen.getByLabelText('New item name')).toBeInTheDocument();
  });

  it('styles a liability category negatively rather than positively', () => {
    const { container } = render(
      <CategorySection
        {...baseProps}
        category={category({ type: 'liability', name: 'Home Loan', items: [item({ id: 'a' })] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('liability')).toBeInTheDocument();
    expect(container.querySelector('.category-section__total.negative')).not.toBeNull();
  });

  it('shows "X of Y items counted" when an item is excluded from net worth', () => {
    render(
      <CategorySection
        {...baseProps}
        category={category({ items: [
          item({ id: 'a' }),
          item({ id: 'b', excludeFromNetWorth: true }),
        ] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('1 of 2 items counted')).toBeInTheDocument();
  });
});

describe('CategorySection — missing preferences', () => {
  it('falls back to INR and the default currency list when preferences are unset', () => {
    appBasePrefs.current = undefined;
    render(
      <CategorySection
        {...baseProps}
        category={category({ items: [item({ id: 'a', amount: 1000 })] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Investments')).toBeInTheDocument();
    // Default currency list fallback reaches the add-item row's currency <select>.
    const currencySelect = screen.getByLabelText('New item currency') as HTMLSelectElement;
    expect(Array.from(currencySelect.options).map(o => o.value)).toEqual(['INR', 'USD', 'EUR', 'GBP', 'SGD']);
  });
});

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

describe('CategorySection group descriptions', () => {
  const described = () => category({
    subCategories: [
      { id: 'sub-mf', name: 'Mutual Funds', description: 'Equity and debt schemes.' },
      { id: 'sub-stocks', name: 'Stocks' },
    ],
    items: [item({ id: 'a', subCategoryId: 'sub-mf' })],
  });

  it('offers the tooltip only for groups that have a description', () => {
    const { container } = render(
      <CategorySection {...baseProps} category={described()} onChange={vi.fn()} />,
    );

    // Exactly one trigger across all three headers — Mutual Funds has a description,
    // Stocks and the Ungrouped bucket do not.
    const triggers = container.querySelectorAll('.subcat-header .info-tooltip-trigger');
    expect(triggers).toHaveLength(1);

    const mfHeader = container.querySelector('.subcat-group .subcat-header')!;
    expect(mfHeader.querySelector('.subcat-header__name')?.textContent).toBe('Mutual Funds');
    expect(mfHeader.querySelector('.info-tooltip-trigger')).not.toBeNull();
  });

  it('reveals the description text when the tooltip is opened', () => {
    const { container } = render(
      <CategorySection {...baseProps} category={described()} onChange={vi.fn()} />,
    );

    expect(screen.queryByText('Equity and debt schemes.')).toBeNull();
    fireEvent.click(container.querySelector('.subcat-header .info-tooltip-trigger')!);
    expect(screen.getByText('Equity and debt schemes.')).toBeInTheDocument();
  });

  it('edits name and description together in one onChange', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={described()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename group Mutual Funds'));
    fireEvent.change(screen.getByLabelText('Rename Mutual Funds'), {
      target: { value: 'MF Portfolio' },
    });
    fireEvent.change(screen.getByLabelText('Description for Mutual Funds'), {
      target: { value: 'Only equity now.' },
    });
    fireEvent.keyDown(screen.getByLabelText('Description for Mutual Funds'), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].subCategories[0]).toMatchObject({
      name: 'MF Portfolio', description: 'Only equity now.',
    });
  });

  it('adds a description to a group that had none', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={described()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename group Stocks'));
    fireEvent.change(screen.getByLabelText('Description for Stocks'), {
      target: { value: 'Direct equity.' },
    });
    fireEvent.keyDown(screen.getByLabelText('Description for Stocks'), { key: 'Enter' });

    expect(onChange.mock.calls[0][0].subCategories[1].description).toBe('Direct equity.');
  });

  it('clearing the description drops the key', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={described()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename group Mutual Funds'));
    fireEvent.change(screen.getByLabelText('Description for Mutual Funds'), {
      target: { value: '  ' },
    });
    fireEvent.keyDown(screen.getByLabelText('Description for Mutual Funds'), { key: 'Enter' });

    expect('description' in onChange.mock.calls[0][0].subCategories[0]).toBe(false);
  });

  it('Escape abandons both fields', () => {
    const onChange = vi.fn();
    render(<CategorySection {...baseProps} category={described()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename group Mutual Funds'));
    fireEvent.change(screen.getByLabelText('Rename Mutual Funds'), { target: { value: 'Nope' } });
    fireEvent.keyDown(screen.getByLabelText('Rename Mutual Funds'), { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
  });
});
