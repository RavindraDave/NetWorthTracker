import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Banner } from '../Banner';

describe('Banner — content rendering', () => {
  it('renders children text', () => {
    render(<Banner icon={<span>!</span>}>Hello world</Banner>);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders the icon', () => {
    render(<Banner icon={<span data-testid="icon">★</span>}>msg</Banner>);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('renders actions when provided', () => {
    render(
      <Banner icon={<span />} actions={<button>Fix it</button>}>msg</Banner>
    );
    expect(screen.getByRole('button', { name: 'Fix it' })).toBeTruthy();
  });

  it('does not render actions container when actions is omitted', () => {
    const { container } = render(<Banner icon={<span />}>msg</Banner>);
    expect(container.querySelectorAll('[style*="flex"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Banner — variant prop', () => {
  it('defaults to info variant without throwing', () => {
    expect(() =>
      render(<Banner icon={<span />}>info msg</Banner>)
    ).not.toThrow();
  });

  it('renders warning variant without throwing', () => {
    expect(() =>
      render(<Banner variant="warning" icon={<span />}>warn msg</Banner>)
    ).not.toThrow();
  });

  it('renders error variant without throwing', () => {
    expect(() =>
      render(<Banner variant="error" icon={<span />}>error msg</Banner>)
    ).not.toThrow();
  });
});
