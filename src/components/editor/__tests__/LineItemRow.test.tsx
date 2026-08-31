import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LineItemRow } from '../LineItemRow';
import type { LineItem } from '../../../types';

// Mock CSS imports
vi.mock('../LineItemRow.css', () => ({}));
vi.mock('../../common/InclusionChips.css', () => ({}));
vi.mock('../../common/CurrencyDisplay', () => ({
  CurrencyDisplay: ({ amount, currency }: { amount: number; currency: string }) => (
    <span>{currency} {amount}</span>
  ),
}));

const mocks = vi.hoisted(() => ({
  preferences: { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD', 'EUR'] } as
    { baseCurrency: string; enabledCurrencies: string[] } | undefined,
  confirm: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({ preferences: mocks.preferences }),
  };
});

vi.mock('../../common/Toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../common/Toast')>();
  return {
    ...actual,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      confirm: mocks.confirm,
    }),
  };
});

function makeItem(overrides: Partial<LineItem> = {}): LineItem {
  return {
    id: 'test-item-1',
    name: 'Test Asset',
    amount: 100000,
    currency: 'INR',
    excludeFromNetWorth: false,
    excludeFromGoals: false,
    ...overrides,
  };
}

const defaultProps = {
  exchangeRates: { USD: 83.5, EUR: 90.2 },
  snapshotMonth: '2026-06',
  onChange: vi.fn(),
  onRemove: vi.fn(),
};

describe('LineItemRow', () => {
  beforeEach(() => {
    defaultProps.onChange.mockClear();
    defaultProps.onRemove.mockClear();
    mocks.preferences = { baseCurrency: 'INR', enabledCurrencies: ['INR', 'USD', 'EUR'] };
    mocks.confirm.mockClear();
    mocks.confirm.mockResolvedValue(true);
  });

  describe('panel toggles', () => {
    it('renders without loan panel initially', () => {
      render(<LineItemRow item={makeItem()} {...defaultProps} />);
      expect(screen.queryByLabelText(/purchase price/i)).toBeNull();
    });

    it('renders without cost basis panel initially', () => {
      render(<LineItemRow item={makeItem()} {...defaultProps} />);
      expect(screen.queryByLabelText(/purchase price/i)).toBeNull();
    });

    it('opens loan panel on Calculator button click', () => {
      render(<LineItemRow item={makeItem()} {...defaultProps} />);
      const loanBtn = screen.getByRole('button', { name: /loan calculator/i });
      expect(loanBtn).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(loanBtn);
      expect(loanBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes loan panel on second click', () => {
      render(<LineItemRow item={makeItem()} {...defaultProps} />);
      const loanBtn = screen.getByRole('button', { name: /loan calculator/i });
      fireEvent.click(loanBtn);
      fireEvent.click(loanBtn);
      expect(loanBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens cost basis panel on TrendingUp button click', () => {
      render(<LineItemRow item={makeItem()} {...defaultProps} />);
      const costBtn = screen.getByRole('button', { name: /toggle return tracking/i });
      expect(costBtn).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(costBtn);
      expect(costBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes cost basis panel on second click', () => {
      render(<LineItemRow item={makeItem()} {...defaultProps} />);
      const costBtn = screen.getByRole('button', { name: /toggle return tracking/i });
      fireEvent.click(costBtn);
      fireEvent.click(costBtn);
      expect(costBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('starts with loan panel open when item has complete loan config', () => {
      const loanItem = makeItem({
        loanPrincipal: 5000000,
        annualInterestRate: 8.5,
        tenureMonths: 240,
        loanStartMonth: '2024-01',
      });
      render(<LineItemRow item={loanItem} {...defaultProps} />);
      const loanBtn = screen.getByRole('button', { name: /loan calculator/i });
      expect(loanBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('starts with cost basis panel open when item has cost basis', () => {
      const costItem = makeItem({ purchasePrice: 80000, purchaseDate: '2024-01-15' });
      render(<LineItemRow item={costItem} {...defaultProps} />);
      const costBtn = screen.getByRole('button', { name: /toggle return tracking/i });
      expect(costBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('starts with return panel open when item has a stated rate', () => {
      const fdItem = makeItem({ statedReturnRate: 5 });
      render(<LineItemRow item={fdItem} {...defaultProps} />);
      const costBtn = screen.getByRole('button', { name: /toggle return tracking/i });
      expect(costBtn).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('item actions', () => {
    it('calls onRemove with item id when delete button clicked', async () => {
      const item = makeItem();
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
      await waitFor(() => expect(defaultProps.onRemove).toHaveBeenCalledWith('test-item-1'));
    });

    it('calls onChange when item name is edited', () => {
      const item = makeItem();
      render(<LineItemRow item={item} {...defaultProps} />);
      const nameInput = screen.getByPlaceholderText(/item name/i);
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Name' })
      );
    });

    it('calls onChange when currency is changed', () => {
      const item = makeItem();
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' })
      );
    });

    it('commits a new amount via the decimal input', () => {
      const item = makeItem();
      render(<LineItemRow item={item} {...defaultProps} />);
      const amountInput = screen.getByLabelText('Amount in INR');
      fireEvent.change(amountInput, { target: { value: '250000' } });
      fireEvent.blur(amountInput);
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 250000 })
      );
    });

    it('cycles the inclusion state via InclusionChips', () => {
      const item = makeItem();
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.click(screen.getByRole('radio', { name: /excluded from everything/i }));
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ excludeFromNetWorth: true, excludeFromGoals: false })
      );
    });

    it('sets goals-only exclusion via InclusionChips', () => {
      const item = makeItem();
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.click(screen.getByRole('radio', { name: /excluded from goals/i }));
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ excludeFromNetWorth: false, excludeFromGoals: true })
      );
    });
  });

  describe('loan panel field commits', () => {
    function openLoanPanel(item: LineItem) {
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /loan calculator/i }));
    }

    it('commits the loan principal', () => {
      const item = makeItem();
      openLoanPanel(item);
      const input = screen.getByLabelText('Loan principal');
      fireEvent.change(input, { target: { value: '5000000' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ loanPrincipal: 5000000 })
      );
    });

    it('commits the annual interest rate', () => {
      const item = makeItem();
      openLoanPanel(item);
      const input = screen.getByLabelText('Annual interest rate');
      fireEvent.change(input, { target: { value: '8.5' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ annualInterestRate: 8.5 })
      );
    });

    it('commits the loan tenure, rounding to whole months', () => {
      const item = makeItem();
      openLoanPanel(item);
      const input = screen.getByLabelText('Loan tenure in months');
      fireEvent.change(input, { target: { value: '240' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ tenureMonths: 240 })
      );
    });

    it('clears a blank tenure to undefined rather than 0', () => {
      const item = makeItem({ tenureMonths: 240 });
      openLoanPanel(item);
      const input = screen.getByLabelText('Loan tenure in months');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ tenureMonths: undefined })
      );
    });

    it('commits the loan start month', () => {
      const item = makeItem();
      openLoanPanel(item);
      fireEvent.change(screen.getByLabelText('Loan start month'), { target: { value: '2024-01' } });
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ loanStartMonth: '2024-01' })
      );
    });

    it('clears all loan fields and closes the panel via "Clear loan"', () => {
      const loanItem = makeItem({
        loanPrincipal: 5000000,
        annualInterestRate: 8.5,
        tenureMonths: 240,
        loanStartMonth: '2024-01',
      });
      render(<LineItemRow item={loanItem} {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear loan'));
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          loanPrincipal: undefined,
          annualInterestRate: undefined,
          tenureMonths: undefined,
          loanStartMonth: undefined,
        })
      );
      expect(screen.getByRole('button', { name: /loan calculator/i })).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('cost basis / return panel field commits', () => {
    function openCostPanel(item: LineItem) {
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /toggle return tracking/i }));
    }

    it('commits the purchase price', () => {
      const item = makeItem();
      openCostPanel(item);
      const input = screen.getByLabelText('Purchase price');
      fireEvent.change(input, { target: { value: '80000' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ purchasePrice: 80000 })
      );
    });

    it('commits the purchase date', () => {
      const item = makeItem();
      openCostPanel(item);
      fireEvent.change(screen.getByLabelText('Purchase date'), { target: { value: '2024-01-15' } });
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ purchaseDate: '2024-01-15' })
      );
    });

    it('commits a stated annual return rate', () => {
      const item = makeItem();
      openCostPanel(item);
      const input = screen.getByLabelText('Stated annual return rate');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ statedReturnRate: 5 })
      );
    });

    it('shows the CAGR "no holding period yet" message when the purchase date is on/after the snapshot month', () => {
      const item = makeItem({ purchasePrice: 80000, purchaseDate: '2026-06-30', amount: 90000 });
      render(<LineItemRow item={item} {...defaultProps} snapshotMonth="2026-06" />);
      expect(screen.getByText(/no holding period yet/i)).toBeInTheDocument();
    });

    it('shows unrealised gain/loss once a purchase price and current value diverge', () => {
      const item = makeItem({ purchasePrice: 80000, purchaseDate: '2024-01-15', amount: 100000 });
      render(<LineItemRow item={item} {...defaultProps} />);
      expect(screen.getByLabelText('Unrealised gain')).toBeInTheDocument();
    });

    it('clears purchase price, date and stated rate via "Clear" and closes the panel', () => {
      const costItem = makeItem({ purchasePrice: 80000, purchaseDate: '2024-01-15', statedReturnRate: 5 });
      render(<LineItemRow item={costItem} {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear'));
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          purchasePrice: undefined,
          purchaseDate: undefined,
          statedReturnRate: undefined,
        })
      );
      expect(screen.getByRole('button', { name: /toggle return tracking/i })).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('sub-category group picker', () => {
    const subCategories = [
      { id: 'sub-1', name: 'Mutual Funds' },
      { id: 'sub-2', name: 'Stocks' },
    ];

    it('is not rendered when no subCategories are supplied', () => {
      render(<LineItemRow item={makeItem()} {...defaultProps} />);
      expect(screen.queryByLabelText(/group for/i)).toBeNull();
    });

    it('is not rendered without an onAssignSubCategory handler even if subCategories exist', () => {
      render(<LineItemRow item={makeItem()} {...defaultProps} subCategories={subCategories} />);
      expect(screen.queryByLabelText(/group for/i)).toBeNull();
    });

    it('assigns an existing group when picked from the select', () => {
      const onAssignSubCategory = vi.fn();
      const item = makeItem();
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={onAssignSubCategory}
        />
      );
      fireEvent.change(screen.getByLabelText(`Group for ${item.name}`), { target: { value: 'sub-1' } });
      expect(onAssignSubCategory).toHaveBeenCalledWith(item.id, { id: 'sub-1' });
    });

    it('un-assigns the group by picking "— No group —"', () => {
      const onAssignSubCategory = vi.fn();
      const item = makeItem({ subCategoryId: 'sub-1' });
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={onAssignSubCategory}
        />
      );
      fireEvent.change(screen.getByLabelText(`Group for ${item.name}`), { target: { value: '__none__' } });
      expect(onAssignSubCategory).toHaveBeenCalledWith(item.id, { id: '' });
    });

    it('treats an orphaned subCategoryId as ungrouped rather than rendering blank', () => {
      const item = makeItem({ subCategoryId: 'does-not-exist' });
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={vi.fn()}
        />
      );
      expect(screen.getByLabelText(`Group for ${item.name}`)).toHaveValue('__none__');
    });

    it('switches to a "new group" text input when "+ New group…" is picked', () => {
      const item = makeItem();
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={vi.fn()}
        />
      );
      fireEvent.change(screen.getByLabelText(`Group for ${item.name}`), { target: { value: '__new__' } });
      expect(screen.getByLabelText(`New group for ${item.name}`)).toBeInTheDocument();
    });

    it('commits a new group name on Enter', () => {
      const onAssignSubCategory = vi.fn();
      const item = makeItem();
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={onAssignSubCategory}
        />
      );
      fireEvent.change(screen.getByLabelText(`Group for ${item.name}`), { target: { value: '__new__' } });
      const input = screen.getByLabelText(`New group for ${item.name}`);
      fireEvent.change(input, { target: { value: 'Bonds' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onAssignSubCategory).toHaveBeenCalledWith(item.id, { newName: 'Bonds' });
      expect(screen.queryByLabelText(`New group for ${item.name}`)).toBeNull();
    });

    it('discards the typed name and reverts to the select on Escape', () => {
      const onAssignSubCategory = vi.fn();
      const item = makeItem();
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={onAssignSubCategory}
        />
      );
      fireEvent.change(screen.getByLabelText(`Group for ${item.name}`), { target: { value: '__new__' } });
      const input = screen.getByLabelText(`New group for ${item.name}`);
      fireEvent.change(input, { target: { value: 'Discard me' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onAssignSubCategory).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(`New group for ${item.name}`)).toBeNull();
    });

    it('shows a "using existing" hint when the typed name matches a group case-insensitively', () => {
      const item = makeItem();
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={vi.fn()}
        />
      );
      fireEvent.change(screen.getByLabelText(`Group for ${item.name}`), { target: { value: '__new__' } });
      fireEvent.change(screen.getByLabelText(`New group for ${item.name}`), { target: { value: 'mutual funds' } });
      expect(screen.getByText(/using existing/i)).toBeInTheDocument();
    });

    it('ignores an ordinary keystroke in the new-group input (neither Enter nor Escape)', () => {
      const onAssignSubCategory = vi.fn();
      const item = makeItem();
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={onAssignSubCategory}
        />
      );
      fireEvent.change(screen.getByLabelText(`Group for ${item.name}`), { target: { value: '__new__' } });
      const input = screen.getByLabelText(`New group for ${item.name}`);
      fireEvent.change(input, { target: { value: 'Sti' } });
      fireEvent.keyDown(input, { key: 'a' });
      expect(onAssignSubCategory).not.toHaveBeenCalled();
      expect(screen.getByLabelText(`New group for ${item.name}`)).toBeInTheDocument();
    });

    it('falls back to "item" in the picker labels when the item has no name', () => {
      const item = makeItem({ name: '' });
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={vi.fn()}
        />
      );
      expect(screen.getByLabelText('Group for item')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Group for item'), { target: { value: '__new__' } });
      expect(screen.getByLabelText('New group for item')).toBeInTheDocument();
    });

    it('does not create a group when the typed name is committed blank', () => {
      const onAssignSubCategory = vi.fn();
      const item = makeItem();
      render(
        <LineItemRow
          item={item}
          {...defaultProps}
          subCategories={subCategories}
          onAssignSubCategory={onAssignSubCategory}
        />
      );
      fireEvent.change(screen.getByLabelText(`Group for ${item.name}`), { target: { value: '__new__' } });
      const input = screen.getByLabelText(`New group for ${item.name}`);
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onAssignSubCategory).not.toHaveBeenCalled();
    });
  });

  describe('initial inclusion state', () => {
    it('shows the goals-only chip active when the item already excludes from goals', () => {
      const item = makeItem({ excludeFromGoals: true });
      render(<LineItemRow item={item} {...defaultProps} />);
      expect(screen.getByRole('radio', { name: /excluded from goals/i })).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('missing preferences fallback', () => {
    it('falls back to INR and the default currency list', () => {
      mocks.preferences = undefined;
      const item = makeItem();
      render(<LineItemRow item={item} {...defaultProps} />);
      const currencySelect = screen.getByLabelText('Currency') as HTMLSelectElement;
      expect(Array.from(currencySelect.options).map(o => o.value)).toEqual(['INR', 'USD', 'EUR', 'GBP', 'SGD']);
    });
  });

  describe('loan and cost-basis field clearing', () => {
    it('clears the loan principal to undefined when the field is blanked', () => {
      const item = makeItem({ loanPrincipal: 500000 });
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /loan calculator/i }));
      const input = screen.getByLabelText('Loan principal');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(expect.objectContaining({ loanPrincipal: undefined }));
    });

    it('clears the purchase price to undefined when the field is blanked', () => {
      // The return panel already starts open because hasCostBasis is true — no click needed.
      const item = makeItem({ purchasePrice: 80000, purchaseDate: '2024-01-15' });
      render(<LineItemRow item={item} {...defaultProps} />);
      const input = screen.getByLabelText('Purchase price');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(expect.objectContaining({ purchasePrice: undefined }));
    });

    it('clears a stated return rate to undefined when the field is blanked', () => {
      // The return panel already starts open because hasStatedRate is true — no click needed.
      const item = makeItem({ statedReturnRate: 5 });
      render(<LineItemRow item={item} {...defaultProps} />);
      const input = screen.getByLabelText('Stated annual return rate');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(defaultProps.onChange).toHaveBeenCalledWith(expect.objectContaining({ statedReturnRate: undefined }));
    });
  });

  describe('loan auto-recompute', () => {
    it('overwrites a stale amount with the freshly computed outstanding balance', () => {
      const item = makeItem({
        amount: 1, // deliberately wrong — should be recomputed on mount
        loanPrincipal: 5000000,
        annualInterestRate: 8.5,
        tenureMonths: 240,
        loanStartMonth: '2024-01',
      });
      render(<LineItemRow item={item} {...defaultProps} snapshotMonth="2026-06" />);
      expect(defaultProps.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: item.id, amount: expect.any(Number) })
      );
      expect(defaultProps.onChange.mock.calls[0][0].amount).not.toBe(1);
    });
  });

  describe('cross-currency conversion display', () => {
    it('shows a warning icon when no exchange rate is set for the item currency', () => {
      const item = makeItem({ currency: 'GBP', amount: 100 }); // GBP has no rate in defaultProps
      const { container } = render(<LineItemRow item={item} {...defaultProps} />);
      expect(container.querySelector('.converted-amount')).not.toBeNull();
      expect(container.querySelector('[title*="No exchange rate set"]')).not.toBeNull();
    });

    it('shows the converted amount without a warning when both rates are set', () => {
      // Base currency is INR, so its own anchor rate must also be present —
      // defaultProps deliberately omits it to make the "missing rate" case easy
      // to trigger elsewhere, so this test supplies its own complete rate set.
      const item = makeItem({ currency: 'USD', amount: 100 });
      const { container } = render(
        <LineItemRow item={item} {...defaultProps} exchangeRates={{ INR: 83, USD: 83.5, EUR: 90.2 }} />
      );
      expect(container.querySelector('.converted-amount')).not.toBeNull();
      expect(container.querySelector('[title*="No exchange rate set"]')).toBeNull();
    });
  });

  describe('remove item', () => {
    it('asks to remove "this item" when the item has no name', async () => {
      const item = makeItem({ name: '' });
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
      await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith('Remove "this item"?', 'destructive'));
    });

    it('does not remove the item when the confirmation is declined', async () => {
      mocks.confirm.mockResolvedValueOnce(false);
      const item = makeItem();
      render(<LineItemRow item={item} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
      await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
      expect(defaultProps.onRemove).not.toHaveBeenCalled();
    });
  });
});
