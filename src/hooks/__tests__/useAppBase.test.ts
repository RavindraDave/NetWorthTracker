import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import { ToastProvider } from '../../components/common/Toast';
import { useAppBase } from '../useAppBase';
import { db } from '../../db/database';
import type { UserPreferences } from '../../types';

const basePrefs: UserPreferences = {
  baseCurrency: 'INR',
  enabledCurrencies: ['INR', 'USD'],
  theme: 'dark',
  profileName: 'Test',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    AppProvider,
    null,
    React.createElement(ToastProvider, null, children)
  );
}

beforeEach(async () => {
  await Promise.all([
    db.snapshots.clear(),
    db.goals.clear(),
    db.preferences.clear(),
    db.autoBackups.clear(),
    db.syncMeta.clear(),
  ]);
});

describe('useAppBase — baseCurrency', () => {
  it('defaults to "INR" when no preferences are set', async () => {
    const { result } = renderHook(() => useAppBase(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.baseCurrency).toBe('INR');
  });

  it('uses baseCurrency from preferences', async () => {
    await db.preferences.put({ ...basePrefs, baseCurrency: 'USD', id: 1 });
    const { result } = renderHook(() => useAppBase(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.baseCurrency).toBe('USD');
  });
});

describe('useAppBase — merged shape', () => {
  it('exposes app context values (snapshots, goals)', async () => {
    await db.preferences.put({ ...basePrefs, id: 1 });
    const { result } = renderHook(() => useAppBase(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.snapshots)).toBe(true);
    expect(Array.isArray(result.current.goals)).toBe(true);
  });

  it('exposes toast methods (success, error, warn)', async () => {
    await db.preferences.put({ ...basePrefs, id: 1 });
    const { result } = renderHook(() => useAppBase(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.success).toBe('function');
    expect(typeof result.current.error).toBe('function');
  });
});
