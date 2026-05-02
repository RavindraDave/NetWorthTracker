import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PieChart, Target, History, Settings } from 'lucide-react';
import './MobileNav.css';

const navItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/portfolio', label: 'Portfolio', icon: PieChart },
  { path: '/history', label: 'History', icon: History },
  { path: '/goals', label: 'Goals', icon: Target },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const MobileNav: React.FC = () => {
  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <item.icon size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
