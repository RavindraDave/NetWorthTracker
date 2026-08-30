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

vi.mock('../../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({
      preferences: {
        baseCurrency: 'INR',
        enabledCurrencies: ['INR', 'USD', 'EUR'],
      },
    }),
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
      confirm: vi.fn().mockResolvedValue(true),
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
  });
});
