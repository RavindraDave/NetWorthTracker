import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const NotificationPermissionCard: React.FC = () => {
  const { preferences, updatePreferences } = useApp();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  // Re-read permission when the user returns to the tab (e.g. after changing browser settings)
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const handleFocus = () => setPermission(Notification.permission);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

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
          {permission === 'denied' ? (
            <>
              Notifications are blocked. To enable: open your browser&apos;s site settings
              for this page, set Notifications to &quot;Allow&quot;, then return here.
            </>
          ) : enabled ? (
            "When you open the app and haven't recorded this month yet, a notification will appear. Reminders fire on app open — not in the background."
          ) : (
            "Get an in-app notification when you open WealthPulse and haven't recorded your net worth this month yet."
          )}
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
