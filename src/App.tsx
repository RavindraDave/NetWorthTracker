import React, { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { AppProvider } from './context/AppContext';
import { ToastProvider, useToast } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RouteSkeleton } from './components/common/RouteSkeleton';
import { Dashboard } from './pages/Dashboard';
import { useApp } from './context/AppContext';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useSnapshotReminder } from './hooks/useSnapshotReminder';
import { ConflictResolutionModal } from './components/common/ConflictResolutionModal';

const SnapshotEditor = lazy(() => import('./pages/SnapshotEditor').then(m => ({ default: m.SnapshotEditor })));
const Goals          = lazy(() => import('./pages/Goals').then(m => ({ default: m.Goals })));
const Portfolio      = lazy(() => import('./pages/Portfolio').then(m => ({ default: m.Portfolio })));
const History        = lazy(() => import('./pages/History').then(m => ({ default: m.History })));
const Settings       = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

const RouteWithBoundary: React.FC<{ element: React.ReactElement; name: string }> = ({ element, name }) => (
  <ErrorBoundary routeName={name}>
    <Suspense fallback={<RouteSkeleton />}>
      {element}
    </Suspense>
  </ErrorBoundary>
);

const AutoBackupManager: React.FC = () => {
  const { snapshots, goals, preferences, updatePreferences } = useApp();
  useAutoBackup({ snapshots, goals, preferences, updatePreferences });
  return null;
};

const SnapshotReminderManager: React.FC = () => {
  useSnapshotReminder();
  return null;
};

const SyncConflictManager: React.FC = () => {
  const { syncConflicts, resolveConflicts, dismissSyncConflicts } = useApp();
  if (!syncConflicts) return null;
  return (
    <ConflictResolutionModal
      conflicts={syncConflicts.result.conflicts}
      onResolve={resolveConflicts}
      onDismiss={dismissSyncConflicts}
    />
  );
};

/**
 * Surfaces the auto-on-load category-id reconciliation pass — silent unless
 * it actually found something (see `applyCategoryReconciliation`'s doc
 * comment in AppContext). One-shot: dismisses itself right after showing,
 * since there's nothing to re-show — a re-run (the manual Settings button)
 * always recomputes fresh from the same deterministic source data.
 */
const CategoryFixManager: React.FC = () => {
  const { categoryFix, dismissCategoryFix } = useApp();
  const { success, warning } = useToast();

  useEffect(() => {
    if (!categoryFix) return;
    if (categoryFix.fixed.length > 0) {
      success(`Fixed ${categoryFix.fixed.length} category ID${categoryFix.fixed.length === 1 ? '' : 's'}.`);
    }
    if (categoryFix.conflicts.length > 0) {
      warning(`${categoryFix.conflicts.length} category ID conflict${categoryFix.conflicts.length === 1 ? '' : 's'} need attention — see Settings → Categories.`);
    }
    dismissCategoryFix();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFix]);

  return null;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'editor/:id', element: <RouteWithBoundary element={<SnapshotEditor />} name="Snapshot Editor" /> },
      { path: 'portfolio',  element: <RouteWithBoundary element={<Portfolio />}      name="Portfolio" /> },
      { path: 'history',    element: <RouteWithBoundary element={<History />}        name="History" /> },
      { path: 'goals',      element: <RouteWithBoundary element={<Goals />}          name="Goals" /> },
      { path: 'settings',   element: <RouteWithBoundary element={<Settings />}       name="Settings" /> },
    ],
  },
]);

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <AutoBackupManager />
          <SnapshotReminderManager />
          <SyncConflictManager />
          <CategoryFixManager />
          <RouterProvider router={router} />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
