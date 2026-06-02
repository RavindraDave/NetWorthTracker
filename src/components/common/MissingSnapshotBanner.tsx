import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';

const SNOOZE_DAYS = 3;
const SNOOZE_KEY = 'missingSnapshotSnoozeUntil';

function isSnoozed(): boolean {
  const val = localStorage.getItem(SNOOZE_KEY);
  if (!val) return false;
  return Date.now() < new Date(val).getTime();
}

export const MissingSnapshotBanner: React.FC = () => {
  const { snapshots, createNewSnapshot, saveSnapshot } = useApp();
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const [snoozed, setSnoozed] = useState(isSnoozed);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const hasCurrentMonth = snapshots.some(s => s.month === currentMonth);

  if (snapshots.length === 0 || hasCurrentMonth || snoozed) return null;

  const [year, mm] = currentMonth.split('-');
  const displayMonth = new Date(Number(year), Number(mm) - 1, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  const handleCreate = async () => {
    const snap = createNewSnapshot();
    const existing = snapshots.find(s => s.month === snap.month);
    if (existing) {
      navigate(`/editor/${existing.id}`);
      return;
    }
    try {
      await saveSnapshot(snap);
      navigate(`/editor/${snap.id}`);
    } catch {
      toastError('Could not create snapshot. A snapshot for that month may already exist.');
    }
  };

  const handleSnooze = () => {
    const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(SNOOZE_KEY, until);
    setSnoozed(true);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.65rem 1rem',
      marginBottom: '1rem',
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
      flexWrap: 'wrap',
    }}>
      <Calendar size={16} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
        No snapshot for <strong>{displayMonth}</strong> yet. Keep your net worth tracking up to date.
      </span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className="btn btn-outline"
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
          onClick={handleCreate}
        >
          Create snapshot
        </button>
        <button
          className="btn-icon"
          aria-label="Dismiss for 3 days"
          title="Dismiss for 3 days"
          onClick={handleSnooze}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
