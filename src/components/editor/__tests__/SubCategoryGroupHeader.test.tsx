import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubCategoryGroupHeader } from '../SubCategoryGroupHeader';
import type { SubCategory } from '../../../types';

vi.mock('../SubCategoryGroupHeader.css', () => ({}));
vi.mock('../../common/InfoTooltip.css', () => ({}));

const siblings: SubCategory[] = [{ id: 'sib-1', name: 'Stocks' }, { id: 'sib-2', name: 'Bonds' }];

function baseProps() {
  return {
    id: 'grp-1',
    name: 'Mutual Funds',
    itemCount: 2,
    total: 50000,
    baseCurrency: 'INR',
    collapsed: false,
    onToggleCollapse: vi.fn(),
    siblings,
    isFirst: false,
    isLast: false,
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onMerge: vi.fn(),
    onDelete: vi.fn(),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('SubCategoryGroupHeader — ungrouped bucket', () => {
  it('renders "Ungrouped" and hides the action buttons', () => {
    render(<SubCategoryGroupHeader {...baseProps()} id={null} name="" description="ignored" />);
    expect(screen.getByText('Ungrouped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename group/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /options for group/i })).toBeNull();
  });
});

describe('SubCategoryGroupHeader — collapse toggle', () => {
  it('calls onToggleCollapse and reflects expanded/collapsed state', () => {
    const props = baseProps();
    const { rerender } = render(<SubCategoryGroupHeader {...props} />);
    const toggle = screen.getByRole('button', { name: /collapse mutual funds/i });
    fireEvent.click(toggle);
    expect(props.onToggleCollapse).toHaveBeenCalled();

    rerender(<SubCategoryGroupHeader {...props} collapsed={true} />);
    expect(screen.getByRole('button', { name: /expand mutual funds/i })).toBeInTheDocument();
  });
});

describe('SubCategoryGroupHeader — description tooltip', () => {
  it('is absent with no description', () => {
    render(<SubCategoryGroupHeader {...baseProps()} />);
    expect(screen.queryByRole('button', { name: /more information/i })).toBeNull();
  });

  it('shows the description body when opened', () => {
    render(<SubCategoryGroupHeader {...baseProps()} description="Equity and debt schemes." />);
    fireEvent.click(screen.getByRole('button', { name: /more information/i }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Equity and debt schemes.');
  });
});

describe('SubCategoryGroupHeader — rename & description editing', () => {
  it('opens the inline editor with the current name and description prefilled', () => {
    render(<SubCategoryGroupHeader {...baseProps()} description="Old desc" />);
    fireEvent.click(screen.getByRole('button', { name: /rename group mutual funds/i }));
    expect(screen.getByLabelText('Rename Mutual Funds')).toHaveValue('Mutual Funds');
    expect(screen.getByLabelText('Description for Mutual Funds')).toHaveValue('Old desc');
  });

  it('commits both name and description together on Enter', () => {
    const props = baseProps();
    render(<SubCategoryGroupHeader {...props} description="Old desc" />);
    fireEvent.click(screen.getByRole('button', { name: /rename group mutual funds/i }));
    fireEvent.change(screen.getByLabelText('Rename Mutual Funds'), { target: { value: 'Stocks & Funds' } });
    fireEvent.change(screen.getByLabelText('Description for Mutual Funds'), { target: { value: 'New desc' } });
    fireEvent.keyDown(screen.getByLabelText('Description for Mutual Funds'), { key: 'Enter' });
    expect(props.onEdit).toHaveBeenCalledWith({ name: 'Stocks & Funds', description: 'New desc' });
  });

  it('does not commit an empty (whitespace-only) name', () => {
    const props = baseProps();
    render(<SubCategoryGroupHeader {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /rename group mutual funds/i }));
    fireEvent.change(screen.getByLabelText('Rename Mutual Funds'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByLabelText('Rename Mutual Funds'), { key: 'Enter' });
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('does not call onEdit when nothing actually changed', () => {
    const props = baseProps();
    render(<SubCategoryGroupHeader {...props} description="Same" />);
    fireEvent.click(screen.getByRole('button', { name: /rename group mutual funds/i }));
    fireEvent.keyDown(screen.getByLabelText('Rename Mutual Funds'), { key: 'Enter' });
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('discards edits on Escape', () => {
    const props = baseProps();
    render(<SubCategoryGroupHeader {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /rename group mutual funds/i }));
    fireEvent.change(screen.getByLabelText('Rename Mutual Funds'), { target: { value: 'Discard me' } });
    fireEvent.keyDown(screen.getByLabelText('Rename Mutual Funds'), { key: 'Escape' });
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(screen.getByText('Mutual Funds')).toBeInTheDocument();
  });

  it('does not commit-and-close when blur moves focus to the description field within the same editor', () => {
    const props = baseProps();
    render(<SubCategoryGroupHeader {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /rename group mutual funds/i }));
    const nameInput = screen.getByLabelText('Rename Mutual Funds');
    const descInput = screen.getByLabelText('Description for Mutual Funds');
    fireEvent.change(nameInput, { target: { value: 'Still editing' } });
    fireEvent.blur(nameInput, { relatedTarget: descInput });
    // Editor should still be open — no commit happened
    expect(screen.getByLabelText('Rename Mutual Funds')).toHaveValue('Still editing');
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('commits on blur when focus leaves the editor entirely', () => {
    const props = baseProps();
    render(
      <div>
        <SubCategoryGroupHeader {...props} />
        <button>outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /rename group mutual funds/i }));
    const nameInput = screen.getByLabelText('Rename Mutual Funds');
    fireEvent.change(nameInput, { target: { value: 'Renamed' } });
    fireEvent.blur(nameInput, { relatedTarget: screen.getByText('outside') });
    expect(props.onEdit).toHaveBeenCalledWith({ name: 'Renamed', description: '' });
  });
});

describe('SubCategoryGroupHeader — options menu', () => {
  function openMenu() {
    fireEvent.click(screen.getByRole('button', { name: /options for group mutual funds/i }));
  }

  it('toggles open and closed on repeated clicks', () => {
    render(<SubCategoryGroupHeader {...baseProps()} />);
    openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    openMenu();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes when clicking outside the menu', () => {
    render(
      <div>
        <SubCategoryGroupHeader {...baseProps()} />
        <button>elsewhere</button>
      </div>
    );
    openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('elsewhere'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables "Move up" when isFirst, and calls onMove(-1) otherwise', () => {
    const props = baseProps();
    const { rerender } = render(<SubCategoryGroupHeader {...props} isFirst />);
    openMenu();
    expect(screen.getByRole('menuitem', { name: /move up/i })).toBeDisabled();

    // Menu is already open (state carries across rerender) — re-query without re-toggling.
    rerender(<SubCategoryGroupHeader {...props} isFirst={false} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /move up/i }));
    expect(props.onMove).toHaveBeenCalledWith(-1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables "Move down" when isLast, and calls onMove(1) otherwise', () => {
    const props = baseProps();
    const { rerender } = render(<SubCategoryGroupHeader {...props} isLast />);
    openMenu();
    expect(screen.getByRole('menuitem', { name: /move down/i })).toBeDisabled();

    rerender(<SubCategoryGroupHeader {...props} isLast={false} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /move down/i }));
    expect(props.onMove).toHaveBeenCalledWith(1);
  });

  it('lists sibling groups under "Merge into" and calls onMerge with the chosen id', () => {
    const props = baseProps();
    render(<SubCategoryGroupHeader {...props} />);
    openMenu();
    expect(screen.getByText('Merge into')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Stocks' }));
    expect(props.onMerge).toHaveBeenCalledWith('sib-1');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('omits the "Merge into" section when there are no siblings', () => {
    render(<SubCategoryGroupHeader {...baseProps()} siblings={[]} />);
    openMenu();
    expect(screen.queryByText('Merge into')).toBeNull();
  });

  it('calls onDelete and closes the menu', () => {
    const props = baseProps();
    render(<SubCategoryGroupHeader {...props} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /delete group/i }));
    expect(props.onDelete).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('SubCategoryGroupHeader — item count and total', () => {
  it('pluralizes the item count correctly', () => {
    const { rerender } = render(<SubCategoryGroupHeader {...baseProps()} itemCount={1} />);
    expect(screen.getByText('1 item')).toBeInTheDocument();
    rerender(<SubCategoryGroupHeader {...baseProps()} itemCount={3} />);
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });
});
