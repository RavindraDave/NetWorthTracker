import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

const NOTIFIED_KEY = 'lastNotifiedMonth';

export function useSnapshotReminder() {
  const { snapshots, preferences } = useApp();

  useEffect(() => {
    if (!preferences?.notificationReminders) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    if (snapshots.some(s => s.month === currentMonth)) return;

    const lastNotified = localStorage.getItem(NOTIFIED_KEY);
    if (lastNotified === currentMonth) return;

    const [year, mm] = currentMonth.split('-');
    const displayMonth = new Date(Number(year), Number(mm) - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });

    new Notification('WealthPulse — Monthly snapshot due', {
      body: `Enter your net worth snapshot for ${displayMonth} to keep your tracking up to date.`,
      icon: '/icons/icon-192.png',
    });

    localStorage.setItem(NOTIFIED_KEY, currentMonth);
  }, [snapshots, preferences]);
}
