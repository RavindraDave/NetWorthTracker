import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SuggestGroupsModal } from '../SuggestGroupsModal';
import type { Category } from '../../../types';
import type { SubCategorySuggestion } from '../../../utils/defaultSubCategories';

vi.mock('../SuggestGroupsModal.css', () => ({}));
vi.mock('../../common/Modal', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
}));

const SUGGESTIONS: SubCategorySuggestion[] = [
  { name: 'Mutual Funds', description: 'Equity, debt and hybrid schemes.' },
  { name: 'Stocks',       description: 'Direct equity in listed companies.' },
  { name: 'Bonds',        description: 'Government securities and debentures.' },
];

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'default-investments', name: 'Investments', type: 'asset', icon: '📈',
    isLiquid: true, isInvestable: true, items: [], ...overrides,
  };
}

function renderModal(cat = category()) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(
    <SuggestGroupsModal
      category={cat} suggestions={SUGGESTIONS} onAdd={onAdd} onClose={onClose}
    />,
  );
  return { onAdd, onClose };
}

const addButton = () => screen.getByRole('button', { name: /^Add \d+ groups?$|^Add groups$/ });

beforeEach(() => vi.clearAllMocks());

describe('SuggestGroupsModal', () => {
  it('shows every suggestion with its description', () => {
    renderModal();
    for (const s of SUGGESTIONS) {
      expect(screen.getByText(s.name)).toBeInTheDocument();
      expect(screen.getByText(s.description)).toBeInTheDocument();
    }
  });

  /** Pre-ticking would make this behave like the add-all button it replaces. */
  it('starts with nothing ticked and the add button disabled', () => {
    renderModal();
    for (const s of SUGGESTIONS) {
      expect(screen.getByLabelText(s.name)).not.toBeChecked();
    }
    expect(addButton()).toBeDisabled();
  });

  it('adds only the ticked suggestions, in one call', () => {
    const { onAdd, onClose } = renderModal();

    fireEvent.click(screen.getByLabelText('Mutual Funds'));
    fireEvent.click(screen.getByLabelText('Bonds'));
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].map((s: SubCategorySuggestion) => s.name))
      .toEqual(['Mutual Funds', 'Bonds']);
    expect(onClose).toHaveBeenCalled();
  });

  it('passes the description through so it can be stored', () => {
    const { onAdd } = renderModal();
    fireEvent.click(screen.getByLabelText('Stocks'));
    fireEvent.click(addButton());
    expect(onAdd.mock.calls[0][0][0].description).toBe('Direct equity in listed companies.');
  });

  it('counts the selection live on the button', () => {
    renderModal();
    fireEvent.click(screen.getByLabelText('Mutual Funds'));
    expect(screen.getByRole('button', { name: 'Add 1 group' })).toBeEnabled();
    fireEvent.click(screen.getByLabelText('Stocks'));
    expect(screen.getByRole('button', { name: 'Add 2 groups' })).toBeEnabled();
  });

  it('unticking removes it again', () => {
    renderModal();
    fireEvent.click(screen.getByLabelText('Stocks'));
    fireEvent.click(screen.getByLabelText('Stocks'));
    expect(addButton()).toBeDisabled();
  });

  it('select all toggles the whole list and back', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('button', { name: 'Add 3 groups' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(addButton()).toBeDisabled();
  });

  it('marks groups the category already has as added and disabled', () => {
    renderModal(category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
    }));

    const mf = screen.getByLabelText('Mutual Funds');
    expect(mf).toBeChecked();
    expect(mf).toBeDisabled();
    expect(screen.getByText('already added')).toBeInTheDocument();
    // Still selectable ones remain untouched.
    expect(screen.getByLabelText('Stocks')).not.toBeChecked();
  });

  it('matches already-added groups case-insensitively', () => {
    renderModal(category({
      subCategories: [{ id: 'sub-mf', name: 'mutual   FUNDS' }],
    }));
    expect(screen.getByLabelText('Mutual Funds')).toBeDisabled();
  });

  it('select all skips the ones already present', () => {
    const { onAdd } = renderModal(category({
      subCategories: [{ id: 'sub-mf', name: 'Mutual Funds' }],
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 groups' }));

    expect(onAdd.mock.calls[0][0].map((s: SubCategorySuggestion) => s.name))
      .toEqual(['Stocks', 'Bonds']);
  });

  it('closes without calling onAdd when cancelled', () => {
    const { onAdd, onClose } = renderModal();
    fireEvent.click(screen.getByLabelText('Stocks'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('hides Select all when everything is already added', () => {
    renderModal(category({
      subCategories: SUGGESTIONS.map((s, i) => ({ id: `sub-${i}`, name: s.name })),
    }));
    expect(screen.queryByRole('button', { name: /Select all|Clear all/ })).toBeNull();
    expect(within(screen.getByRole('dialog')).getAllByText('already added')).toHaveLength(3);
  });
});
