
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { AppProvider } from './context/AppContext';
import { Dashboard } from './pages/Dashboard';
import { SnapshotEditor } from './pages/SnapshotEditor';
import { Goals } from './pages/Goals';
import { Portfolio } from './pages/Portfolio';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="editor/:id" element={<SnapshotEditor />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="history" element={<History />} />
            <Route path="goals" element={<Goals />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
