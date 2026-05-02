import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

// Mounts inside AppProvider so it can read context
const AutoBackupManager: React.FC = () => {
  const { snapshots, goals, preferences, updatePreferences } = useApp();
  useAutoBackup({ snapshots, goals, preferences, updatePreferences });
  return null;
};

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <AutoBackupManager />
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="editor/:id" element={<RouteWithBoundary element={<SnapshotEditor />} name="Snapshot Editor" />} />
                <Route path="portfolio"  element={<RouteWithBoundary element={<Portfolio />}      name="Portfolio" />} />
                <Route path="history"    element={<RouteWithBoundary element={<History />}        name="History" />} />
                <Route path="goals"      element={<RouteWithBoundary element={<Goals />}          name="Goals" />} />
                <Route path="settings"   element={<RouteWithBoundary element={<Settings />}       name="Settings" />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
