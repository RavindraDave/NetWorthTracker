import React from 'react';
import { Bell, PlusCircle } from 'lucide-react';
import './Header.css';

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = 'Dashboard' }) => {
  return (
    <header className="top-header">
      <div className="header-title">
        <h2 className="text-h2">{title}</h2>
      </div>
      <div className="header-actions">
        <button className="btn btn-outline icon-btn">
          <Bell size={20} />
        </button>
        <button className="btn btn-primary new-snapshot-btn">
          <PlusCircle size={20} />
          <span>New Snapshot</span>
        </button>
      </div>
    </header>
  );
};
