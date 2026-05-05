import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, PlusCircle, Calendar, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import './Header.css';

interface HeaderProps {
  title?: string;
}

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

export const Header: React.FC<HeaderProps> = ({ title = 'Dashboard' }) => {
  const { snapshots, createNewSnapshot, saveSnapshot } = useApp();
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');

  const handleOpenPicker = () => {
    setSelectedMonth(getDefaultMonth(snapshots));
    setShowPicker(true);
  };

  const handleClose = () => setShowPicker(false);

  const existingForMonth = snapshots.find(s => s.month === selectedMonth);

  const handleSubmit = async () => {
    if (!selectedMonth) return;
    if (existingForMonth) {
      navigate(`/editor/${existingForMonth.id}`);
      setShowPicker(false);
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
      setShowPicker(false);
    } catch {
      toastError('Could not create snapshot. A snapshot for that month may already exist.');
    }
  };

  return (
    <>
      <header className="top-header">
        <div className="header-title">
          <h2 className="text-h2">{title}</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline icon-btn" aria-label="Notifications (coming soon)" title="Notifications coming soon" disabled>
            <Bell size={20} />
          </button>
          <button className="btn btn-primary new-snapshot-btn" onClick={handleOpenPicker}>
            <PlusCircle size={20} />
            <span>New Snapshot</span>
          </button>
        </div>
      </header>

      {showPicker && (
        <Modal
          onClose={handleClose}
          contentStyle={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', maxWidth: '380px' }}
          aria-label="New Snapshot"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'nowrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <Calendar size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>New Snapshot</h3>
            </div>
            <button className="btn-icon" onClick={handleClose} title="Close" aria-label="Close" style={{ flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0.75rem 0 1.25rem', lineHeight: 1.5 }}>
            Pick any month. Assets and rates will be pre-filled from your latest snapshot.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Month</label>
            <input
              type="month"
              className="line-item-input"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', fontSize: '1rem' }}
            />
            {existingForMonth && (
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-yellow, #f59e0b)', margin: '0.25rem 0 0' }}>
                A snapshot already exists for this month — it will be opened.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={handleClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!selectedMonth}>
              {existingForMonth ? 'Open Snapshot' : 'Create Snapshot'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};
