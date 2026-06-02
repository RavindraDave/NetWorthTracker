import React, { useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const NotificationPermissionCard: React.FC = () => {
  const { preferences, updatePreferences } = useApp();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  if (!preferences) return null;
  if (typeof Notification === 'undefined') return null;

  const enabled = !!(preferences.notificationReminders && permission === 'granted');

  const handleEnable = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      updatePreferences({ notificationReminders: true });
    }
  };

  const handleDisable = () => {
    updatePreferences({ notificationReminders: false });
  };

  return (
    <div className="data-action-card">
      <div className="data-action-card__info">
        <h3 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {enabled
            ? <BellRing size={18} className="text-positive" />
            : permission === 'denied'
              ? <BellOff size={18} style={{ opacity: 0.5 }} />
              : <Bell size={18} style={{ opacity: 0.6 }} />
          }
          Monthly Reminders
        </h3>
        <p className="text-muted text-sm">
          {permission === 'denied'
            ? 'Notifications are blocked in your browser. Enable them in browser settings to use this feature.'
            : enabled
              ? "When you open the app and the current month has no snapshot, you'll receive a reminder notification."
              : "Get a notification when you open the app and haven't entered this month's snapshot yet."
          }
        </p>
      </div>
      {permission !== 'denied' && (
        enabled
          ? <button className="btn btn-outline" onClick={handleDisable}>Disable</button>
          : <button className="btn btn-outline" onClick={handleEnable}>Enable reminders</button>
      )}
    </div>
  );
};
