import React from 'react';
import { AppLockCard } from './AppLockCard';

export const AppLockSection: React.FC = () => (
  <div className="wp-card settings-section">
    <h2 className="settings-h2">Security</h2>
    <AppLockCard />
  </div>
);
