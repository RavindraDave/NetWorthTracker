import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import { Banner } from './Banner';
import { TEXT } from './theme';

const SNOOZE_DAYS = 7;
const SNOOZE_KEY = 'wealthpulse_missingSnapshotSnoozeUntil';

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
    <Banner
      variant="info"
      icon={<Calendar size={16} />}
      actions={
        <>
          <button
            className="btn btn-outline"
            style={{ fontSize: TEXT.base, padding: '0.3rem 0.7rem' }}
            onClick={handleCreate}
          >
            Create snapshot
          </button>
          <button className="btn-icon" aria-label="Dismiss for 7 days" title="Dismiss for 7 days" onClick={handleSnooze}>
            <X size={14} />
          </button>
        </>
      }
    >
      You haven't recorded your net worth for <strong>{displayMonth}</strong> yet.
    </Banner>
  );
};
