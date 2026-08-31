import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MissingSnapshotBanner } from '../MissingSnapshotBanner';
import type { Snapshot, UserPreferences } from '../../../types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createNewSnapshot: vi.fn(),
  cloneLatestSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  updatePreferences: vi.fn(),
  toastError: vi.fn(),
  appState: {
    snapshots: [] as Snapshot[],
    preferences: null as UserPreferences | null,
  },
}));

vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({
    snapshots: mocks.appState.snapshots,
    preferences: mocks.appState.preferences,
    createNewSnapshot: mocks.createNewSnapshot,
    cloneLatestSnapshot: mocks.cloneLatestSnapshot,
    saveSnapshot: mocks.saveSnapshot,
    updatePreferences: mocks.updatePreferences,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../Toast', () => ({
  useToast: () => ({ error: mocks.toastError }),
}));

function snap(month: string, overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: `snap-${month}`, month, createdAt: '', updatedAt: '',
    exchangeRates: {}, categories: [], ...overrides,
  };
}

function prefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return { baseCurrency: 'INR', enabledCurrencies: ['INR'], theme: 'dark', profileName: 'User', ...overrides };
}

/** "YYYY-MM" for N months before the current month. */
function monthAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const currentMonth = () => monthAgo(0);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appState.snapshots = [];
  mocks.appState.preferences = null;
});

describe('MissingSnapshotBanner — visibility', () => {
  it('renders nothing before preferences load', () => {
    mocks.appState.preferences = null;
    mocks.appState.snapshots = [snap(monthAgo(2))];
    const { container } = render(<MissingSnapshotBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a brand-new user with no snapshots at all', () => {
    mocks.appState.preferences = prefs();
    mocks.appState.snapshots = [];
    const { container } = render(<MissingSnapshotBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the current month is already recorded', () => {
    mocks.appState.preferences = prefs();
    mocks.appState.snapshots = [snap(currentMonth())];
    const { container } = render(<MissingSnapshotBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while snoozed', () => {
    mocks.appState.preferences = prefs({
      missingSnapshotSnoozeUntil: new Date(Date.now() + 60_000).toISOString(),
    });
    mocks.appState.snapshots = [snap(monthAgo(2))];
    const { container } = render(<MissingSnapshotBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders once a snooze has expired', () => {
    mocks.appState.preferences = prefs({
      missingSnapshotSnoozeUntil: new Date(Date.now() - 60_000).toISOString(),
    });
    mocks.appState.snapshots = [snap(monthAgo(2))];
    render(<MissingSnapshotBanner />);
    expect(screen.getByText('Create snapshot')).toBeInTheDocument();
  });

  it('renders when the latest snapshot is behind the current month', () => {
    mocks.appState.preferences = prefs();
    mocks.appState.snapshots = [snap(monthAgo(2))];
    render(<MissingSnapshotBanner />);
    expect(screen.getByText(/haven't recorded your net worth for/)).toBeInTheDocument();
    expect(screen.getByText('Create snapshot')).toBeInTheDocument();
  });
});

describe('MissingSnapshotBanner — creating the missing month', () => {
  beforeEach(() => {
    mocks.appState.preferences = prefs();
  });

  /**
   * The bug this session fixed: the banner guards on and advertises the CURRENT
   * month, but cloneLatestSnapshot() returns "latest + 1" — which is only the
   * current month when the user is exactly one month behind. Two months behind,
   * the old code opened the wrong snapshot.
   */
  it('pins the created snapshot to the current month, not whatever cloneLatestSnapshot returns', async () => {
    mocks.appState.snapshots = [snap(monthAgo(2))]; // two months behind
    mocks.cloneLatestSnapshot.mockReturnValue(snap(monthAgo(1), { id: 'cloned' })); // latest+1 = one month ago, NOT current
    mocks.saveSnapshot.mockResolvedValue(undefined);

    render(<MissingSnapshotBanner />);
    fireEvent.click(screen.getByText('Create snapshot'));

    await waitFor(() => expect(mocks.saveSnapshot).toHaveBeenCalled());
    const saved = mocks.saveSnapshot.mock.calls[0][0];
    expect(saved.month).toBe(currentMonth());
    expect(mocks.navigate).toHaveBeenCalledWith(`/editor/${saved.id}`);
  });

  it('carries the cloned balances forward (id and other fields from cloneLatestSnapshot)', async () => {
    mocks.appState.snapshots = [snap(monthAgo(1))];
    mocks.cloneLatestSnapshot.mockReturnValue(snap(currentMonth(), { id: 'cloned-id', notes: 'carried' }));
    mocks.saveSnapshot.mockResolvedValue(undefined);

    render(<MissingSnapshotBanner />);
    fireEvent.click(screen.getByText('Create snapshot'));

    await waitFor(() => expect(mocks.saveSnapshot).toHaveBeenCalled());
    expect(mocks.saveSnapshot.mock.calls[0][0].notes).toBe('carried');
  });

  it('surfaces a toast error when saving fails rather than throwing', async () => {
    mocks.appState.snapshots = [snap(monthAgo(1))];
    mocks.cloneLatestSnapshot.mockReturnValue(snap(currentMonth()));
    mocks.saveSnapshot.mockRejectedValue(new Error('duplicate_month'));

    render(<MissingSnapshotBanner />);
    fireEvent.click(screen.getByText('Create snapshot'));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(
      'Could not create snapshot. A snapshot for that month may already exist.',
    ));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe('MissingSnapshotBanner — snoozing', () => {
  it('snoozes for roughly 7 days from now', async () => {
    mocks.appState.preferences = prefs();
    mocks.appState.snapshots = [snap(monthAgo(2))];
    mocks.updatePreferences.mockResolvedValue(undefined);

    const before = Date.now();
    render(<MissingSnapshotBanner />);
    fireEvent.click(screen.getByLabelText('Dismiss for 7 days'));

    await waitFor(() => expect(mocks.updatePreferences).toHaveBeenCalled());
    const until = new Date(mocks.updatePreferences.mock.calls[0][0].missingSnapshotSnoozeUntil).getTime();
    const days = (until - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });
});
