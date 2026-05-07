import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import './Layout.css';

function getDefaultMonth(snapshots: { month: string }[]): string {
  if (snapshots.length === 0) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const latest = [...snapshots].sort((a, b) => b.month.localeCompare(a.month))[0];
  const [year, month] = latest.month.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { snapshots, createNewSnapshot, saveSnapshot, isLoading } = useApp();
  const { error: toastError } = useToast();

  const [showNewSnapshot, setShowNewSnapshot] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');

  const handleOpenNewSnapshot = () => {
    setSelectedMonth(getDefaultMonth(snapshots));
    setShowNewSnapshot(true);
  };

  const handleCloseNewSnapshot = () => setShowNewSnapshot(false);

  const existingForMonth = snapshots.find(s => s.month === selectedMonth);

  const handleSubmitNewSnapshot = async () => {
    if (!selectedMonth) return;
    if (existingForMonth) {
      navigate(`/editor/${existingForMonth.id}`);
      setShowNewSnapshot(false);
      return;
    }
    const latest = [...snapshots].sort((a, b) => b.month.localeCompare(a.month))[0];
    const now = new Date();
    const snap = latest
      ? { ...latest, id: crypto.randomUUID(), month: selectedMonth, createdAt: now.toISOString(), updatedAt: now.toISOString() }
      : { ...createNewSnapshot(), month: selectedMonth };
    try {
      await saveSnapshot(snap);
      navigate(`/editor/${snap.id}`);
      setShowNewSnapshot(false);
    } catch {
      toastError('Could not create snapshot. A snapshot for that month may already exist.');
    }
  };

  // Derive title / breadcrumb from current route
  let title: string | undefined;
  let breadcrumb: string[] | undefined;
  const path = location.pathname;

  if (path === '/') {
    title = 'Dashboard';
  } else if (path.startsWith('/portfolio')) {
    title = 'Portfolio';
  } else if (path.startsWith('/goals')) {
    title = 'Goals';
  } else if (path.startsWith('/history')) {
    title = 'History';
  } else if (path.startsWith('/settings')) {
    title = 'Settings';
  } else if (path.startsWith('/editor')) {
    const id = path.split('/').pop();
    const snap = snapshots.find(s => s.id === id);
    if (snap) {
      const [year, month] = snap.month.split('-');
      const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      breadcrumb = ['Snapshot Editor', label];
    } else {
      breadcrumb = ['Snapshot Editor'];
    }
  }

  return (
    <div className="layout-container">
      <Sidebar onNewSnapshot={handleOpenNewSnapshot} />
      <div className="layout-content">
        <Header title={title} breadcrumb={breadcrumb} />
        <main className="main-content">
          {isLoading ? (
            <div className="layout-loading">
              <div className="dashboard-loading__spinner" />
              <p style={{ color: 'var(--text-3)', marginTop: '1rem' }}>Loading your wealth data…</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <MobileNav onNewSnapshot={handleOpenNewSnapshot} />

      {showNewSnapshot && (
        <Modal
          onClose={handleCloseNewSnapshot}
          contentStyle={{ padding: '1.5rem', borderRadius: 'var(--radius)', maxWidth: '380px' }}
          aria-label="New Snapshot"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <Calendar size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>New Snapshot</h3>
            </div>
            <button className="btn-icon" onClick={handleCloseNewSnapshot} title="Close" aria-label="Close" style={{ flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', margin: '0.75rem 0 1.25rem', lineHeight: 1.5 }}>
            Pick any month. Assets and rates will be pre-filled from your latest snapshot.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Month</label>
            <input
              type="month"
              className="line-item-input"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', fontSize: '1rem' }}
            />
            {existingForMonth && (
              <p style={{ fontSize: '0.8rem', color: 'var(--amber)', margin: '0.25rem 0 0' }}>
                A snapshot already exists for this month — it will be opened.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={handleCloseNewSnapshot}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmitNewSnapshot} disabled={!selectedMonth}>
              {existingForMonth ? 'Open Snapshot' : 'Create Snapshot'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
