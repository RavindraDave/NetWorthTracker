import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { googleDriveProvider } from '../../utils/cloudSync/google/drive';
import './Sidebar.css';

interface SidebarProps {
  onNewSnapshot: () => void;
}

const VIEW_ITEMS = [
  { path: '/', end: true, label: 'Dashboard', svg: 'M3 12l2-2 7-7 7 7 2 2M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10' },
  { path: '/portfolio', label: 'Portfolio', svg: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512A9.025 9.025 0 0120.488 9z' },
  { path: '/history', label: 'History', svg: 'M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const PLAN_ITEMS = [
  { path: '/goals', label: 'Goals', svg: 'M5 12l5 5L20 7' },
];

const EDITOR_SVG = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 113 3L11.8 15H9v-2.8l8.6-8.6z';
const SETTINGS_SVG = 'M12 9a3 3 0 100 6 3 3 0 000-6zm9 3a8.94 8.94 0 00-.18-1.78l1.93-1.5-2-3.46-2.27.91A8.96 8.96 0 0016 4.83V2.5h-4v2.33a8.96 8.96 0 00-2.48 1.34l-2.27-.91-2 3.46 1.93 1.5A8.94 8.94 0 003 12c0 .61.06 1.2.18 1.78l-1.93 1.5 2 3.46 2.27-.91A8.96 8.96 0 008 19.17V21.5h4v-2.33a8.96 8.96 0 002.48-1.34l2.27.91 2-3.46-1.93-1.5c.12-.58.18-1.17.18-1.78z';

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({ onNewSnapshot }) => {
  const location = useLocation();
  const { preferences } = useApp();
  const isEditor = location.pathname.startsWith('/editor');

  const driveConnected = preferences?.cloudSync?.enabled && preferences.cloudSync.provider === 'google';
  const driveName    = driveConnected ? googleDriveProvider.getName()    : null;
  const driveAvatar  = driveConnected ? googleDriveProvider.getPicture() : null;

  const displayName = driveName || preferences?.profileName || '';
  const initials = displayName
    ? displayName.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')
    : 'WP';

  return (
    <nav className="wp-sidebar">
      <div className="wp-sidebar-logo">
        <div className="wp-logo-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 17l4-4 4 4 4-8 4 4 2-2" />
          </svg>
        </div>
        <span className="wp-logo-text">WealthPulse</span>
      </div>

      <div className="wp-sidebar-nav">
        <div className="wp-nav-group">
          <div className="wp-nav-eyebrow">View</div>
          {VIEW_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `wp-nav-item${isActive ? ' wp-nav-active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="wp-nav-indicator" />}
                  <NavIcon d={item.svg} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="wp-nav-group wp-nav-primary">
          <div className="wp-nav-eyebrow">Action</div>
          <button
            className={`wp-nav-item${isEditor ? ' wp-nav-active' : ''}`}
            onClick={onNewSnapshot}
          >
            {isEditor && <span className="wp-nav-indicator" />}
            <NavIcon d={EDITOR_SVG} />
            <span>Snapshot Editor</span>
          </button>
        </div>

        <div className="wp-nav-group">
          <div className="wp-nav-eyebrow">Plan</div>
          {PLAN_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `wp-nav-item${isActive ? ' wp-nav-active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="wp-nav-indicator" />}
                  <NavIcon d={item.svg} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="wp-nav-settings-wrap">
          <NavLink to="/settings" className={({ isActive }) => `wp-nav-item${isActive ? ' wp-nav-active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <span className="wp-nav-indicator" />}
                <NavIcon d={SETTINGS_SVG} />
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </div>
      </div>

      <div className="wp-sidebar-foot">
        {driveAvatar
          ? <img src={driveAvatar} alt={displayName} className="wp-user-avatar wp-user-avatar--photo" referrerPolicy="no-referrer" />
          : <div className="wp-user-avatar">{initials}</div>
        }
        <div>
          <div className="wp-user-name">{displayName || 'WealthPulse'}</div>
          <div className="wp-user-tier">
            {driveConnected ? 'Google Drive · Synced' : 'Local-only · Encrypted'}
          </div>
        </div>
      </div>

      <a
        href="https://r2dsolutions.com"
        target="_blank"
        rel="noopener noreferrer"
        className="wp-brand-credit"
        aria-label="Built by R2DSolutions"
      >
        <img
          src="https://extensions.r2dsolutions.com/logo.png"
          alt="R2DSolutions"
          className="wp-brand-logo"
        />
        <span>by R2DSolutions</span>
      </a>
    </nav>
  );
};
