import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './MobileNav.css';

interface MobileNavProps {
  onNewSnapshot: () => void;
}

function TabIcon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const TAB_ITEMS = [
  { path: '/', end: true, label: 'Dashboard', d: 'M3 12l2-2 7-7 7 7 2 2M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10' },
  { path: '/history', label: 'History', d: 'M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/goals', label: 'Goals', d: 'M5 12l5 5L20 7' },
  { path: '/settings', label: 'Settings', d: 'M12 9a3 3 0 100 6 3 3 0 000-6z' },
];

const EDITOR_SVG = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 113 3L11.8 15H9v-2.8l8.6-8.6z';

export const MobileNav: React.FC<MobileNavProps> = ({ onNewSnapshot }) => {
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/editor');

  return (
    <nav className="mob-tab">
      {TAB_ITEMS.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          className={({ isActive }) => `mob-tab-btn${isActive ? ' active' : ''}`}
        >
          <TabIcon d={item.d} />
          <span className="mob-tab-label">{item.label}</span>
        </NavLink>
      ))}
      <button
        className={`mob-tab-btn${isEditor ? ' active' : ''}`}
        onClick={onNewSnapshot}
        aria-label="New Snapshot"
      >
        <TabIcon d={EDITOR_SVG} />
        <span className="mob-tab-label">New</span>
      </button>
    </nav>
  );
};
