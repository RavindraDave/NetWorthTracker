import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddItemRow } from '../AddItemRow';

vi.mock('../AddItemRow.css', () => ({}));

vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({ preferences: { baseCurrency: 'INR', numberFormat: 'auto' } }),
}));

const baseProps = {
  baseCurrency: 'INR',
  enabledCurrencies: ['INR', 'USD', 'EUR'],
};

beforeEach(() => vi.clearAllMocks());

describe('AddItemRow — committing via the button', () => {
  it('commits a new item with the typed name and amount, then clears the row', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('New item name'), { target: { value: 'Savings' } });
    fireEvent.change(screen.getByLabelText('New item amount in INR'), { target: { value: '5000' } });
    fireEvent.blur(screen.getByLabelText('New item amount in INR')); // commits the decimal input
    fireEvent.click(screen.getByLabelText('Add item'));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Savings', amount: 5000, currency: 'INR', excludeFromNetWorth: false,
    }));
    expect(screen.getByLabelText('New item name')).toHaveValue('');
  });

  it('does not commit a blank name', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    expect(screen.getByLabelText('Add item')).toBeDisabled();
  });

  it('attaches subCategoryId only when one is provided', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} subCategoryId="sub-1" subCategoryName="Mutual Funds" />);
    fireEvent.change(screen.getByLabelText('New item name in Mutual Funds'), { target: { value: 'Fund' } });
    fireEvent.click(screen.getByLabelText('Add item to Mutual Funds'));
    expect(onAdd.mock.calls[0][0].subCategoryId).toBe('sub-1');
  });

  it('omits the subCategoryId key entirely when ungrouped', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('New item name'), { target: { value: 'Loose' } });
    fireEvent.click(screen.getByLabelText('Add item'));
    expect('subCategoryId' in onAdd.mock.calls[0][0]).toBe(false);
  });

  it('lets the user pick a different currency, and keeps it after committing', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('New item currency'), { target: { value: 'USD' } });
    fireEvent.change(screen.getByLabelText('New item name'), { target: { value: 'US fund' } });
    fireEvent.click(screen.getByLabelText('Add item'));

    expect(onAdd.mock.calls[0][0].currency).toBe('USD');
    // Currency is deliberately preserved across items — no reselecting for every entry.
    expect(screen.getByLabelText('New item currency')).toHaveValue('USD');
  });

  it('refocuses the name field after committing, ready for the next item', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('New item name'), { target: { value: 'One' } });
    fireEvent.click(screen.getByLabelText('Add item'));
    expect(screen.getByLabelText('New item name')).toHaveFocus();
  });
});

describe('AddItemRow — committing via Enter', () => {
  it('commits on Enter in the name field', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    const nameInput = screen.getByLabelText('New item name');
    fireEvent.change(nameInput, { target: { value: 'Enter item' } });
    fireEvent.keyDown(nameInput, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Enter item' }));
  });

  it('does nothing on Enter with a blank name (resets silently)', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    fireEvent.keyDown(screen.getByLabelText('New item name'), { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('AddItemRow — committing via blur (tabbing away)', () => {
  it('commits when the amount field loses focus with a name already typed', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('New item name'), { target: { value: 'Blur commit' } });
    fireEvent.blur(screen.getByLabelText('New item amount in INR'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Blur commit' }));
  });

  it('does not commit on blur when the name is still blank', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    fireEvent.blur(screen.getByLabelText('New item amount in INR'));
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('AddItemRow — Escape', () => {
  it('clears the row on Escape without committing', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    const nameInput = screen.getByLabelText('New item name');
    fireEvent.change(nameInput, { target: { value: 'Discard me' } });
    fireEvent.keyDown(nameInput, { key: 'Escape' });

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New item name')).toHaveValue('');
  });

  /**
   * Escape calls reset() then blur() on the target. Blurring the amount field
   * would normally commit if `name` were still non-empty, but reset()'s
   * setName('') hasn't flushed to the DOM yet — skipBlurCommitRef is what stops
   * that stale-closure blur from creating a phantom item.
   */
  it('does not let the synchronous blur triggered by Escape create a duplicate item', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    const amountInput = screen.getByLabelText('New item amount in INR');
    amountInput.focus(); // real focus, so element.blur() inside handleKeyDown actually fires
    fireEvent.change(screen.getByLabelText('New item name'), { target: { value: 'Would-be duplicate' } });
    fireEvent.keyDown(amountInput, { key: 'Escape' });

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('resumes normal blur-commit behaviour on the next entry after an Escape', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    const nameInput = screen.getByLabelText('New item name');
    const amountInput = screen.getByLabelText('New item amount in INR');

    // jsdom only fires a real blur event from element.blur() when the element was
    // actually genuinely focused first (not just given a synthetic focus event) —
    // needed for handleKeyDown's own `.blur()` call to synchronously consume
    // skipBlurCommitRef the way it does in a real browser. The Escape sequence
    // itself ends with the amount field genuinely blurred (real focus moves to
    // nothing), so the next commit below is exercised via a plain synthetic blur.
    amountInput.focus();
    fireEvent.change(nameInput, { target: { value: 'Cancelled' } });
    fireEvent.keyDown(amountInput, { key: 'Escape' });

    fireEvent.change(nameInput, { target: { value: 'Real item' } });
    fireEvent.blur(amountInput);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Real item' }));
  });
});

describe('AddItemRow — re-entrant blur from commit()\'s own refocus', () => {
  /**
   * commit() ends by calling nameRef.current.focus(). If the amount field was the
   * genuinely-focused DOM element (not just synthetically blurred), that refocus
   * forces a second real blur on it mid-commit — and since reset()'s setName('')
   * hasn't flushed to the `name` closure yet, an unguarded onBlur would silently
   * commit a second, duplicate item. isCommittingRef exists to prevent exactly this.
   */
  it('commits exactly once even when the amount field is genuinely focused at commit time', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    const nameInput = screen.getByLabelText('New item name');
    const amountInput = screen.getByLabelText('New item amount in INR');

    amountInput.focus(); // real focus — the condition the bug depends on
    fireEvent.change(nameInput, { target: { value: 'Once only' } });
    fireEvent.blur(amountInput); // triggers commit(), which calls nameRef.current.focus()

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Once only' }));
  });

  it('leaves the row able to commit a further item normally afterwards', () => {
    const onAdd = vi.fn();
    render(<AddItemRow {...baseProps} onAdd={onAdd} />);
    const nameInput = screen.getByLabelText('New item name');
    const amountInput = screen.getByLabelText('New item amount in INR');

    amountInput.focus();
    fireEvent.change(nameInput, { target: { value: 'First' } });
    fireEvent.blur(amountInput);

    fireEvent.change(nameInput, { target: { value: 'Second' } });
    fireEvent.click(screen.getByLabelText('Add item'));

    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onAdd).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'First' }));
    expect(onAdd).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'Second' }));
  });
});
