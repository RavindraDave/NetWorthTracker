import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from './components/layout/Layout';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RouteSkeleton } from './components/common/RouteSkeleton';
import { Dashboard } from './pages/Dashboard';
import { useApp } from './context/AppContext';
import { useAutoBackup } from './hooks/useAutoBackup';

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
          <RouterProvider router={router} />
          <Analytics />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
