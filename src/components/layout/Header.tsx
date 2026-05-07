import React from 'react';
import { useApp } from '../../context/AppContext';
import './Header.css';

interface HeaderProps {
  title?: string;
  breadcrumb?: string[];
}

export const Header: React.FC<HeaderProps> = ({ title, breadcrumb }) => {
  const { preferences, updatePreferences } = useApp();
  const theme = preferences?.theme ?? 'dark';

  const toggleTheme = () => {
    updatePreferences({ theme: theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <header className="wp-topbar">
      <div className="wp-topbar-title">
        {breadcrumb ? (
          breadcrumb.map((seg, i) => (
            <React.Fragment key={i}>
              <span className={i === breadcrumb.length - 1 ? 'wp-bc-current' : 'wp-bc'}>{seg}</span>
              {i < breadcrumb.length - 1 && <span className="wp-bc-sep"> / </span>}
            </React.Fragment>
          ))
        ) : (
          title
        )}
      </div>
      <div className="wp-topbar-actions">
        <button
          className="wp-icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};
