import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useApp } from '../../context/AppContext';
import './Layout.css';

export const Layout: React.FC = () => {
  const location = useLocation();
  const { isLoading } = useApp();
  
  // Basic logic to determine title from path
  let title = 'Dashboard';
  if (location.pathname.includes('/portfolio')) title = 'Portfolio';
  if (location.pathname.includes('/goals')) title = 'FIRE Goals';
  if (location.pathname.includes('/history')) title = 'History';
  if (location.pathname.includes('/settings')) title = 'Settings';
  if (location.pathname.includes('/editor')) title = 'Snapshot Editor';

  return (
    <div className="layout-container">
      <Sidebar />
      <div className="layout-content">
        <Header title={title} />
        <main className="main-content">
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '50vh' }}>
              <div className="dashboard-loading__spinner" />
              <p className="text-muted" style={{ marginTop: '1rem' }}>Loading your wealth data…</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
};
