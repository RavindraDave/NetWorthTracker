import React, { useState } from 'react';
import { Settings as SettingsIcon, Search, Archive, Download, RefreshCw } from 'lucide-react';
import { PreferencesSection } from '../components/settings/PreferencesSection';
import { CurrenciesSection } from '../components/settings/CurrenciesSection';
import { CategoriesSection } from '../components/settings/CategoriesSection';
import { DataBackupSection } from '../components/settings/DataBackupSection';
import { CloudSyncSection } from '../components/settings/CloudSyncSection';
import './Settings.css';

type Section = 'preferences' | 'currencies' | 'categories' | 'data' | 'sync';

export const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>(() => {
    return (localStorage.getItem('settings-section') as Section) || 'preferences';
  });

  const setSection = (s: Section) => {
    setActiveSection(s);
    localStorage.setItem('settings-section', s);
  };

  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'preferences', label: 'Preferences',   icon: <SettingsIcon size={15} /> },
    { id: 'currencies',  label: 'Currencies',    icon: <Search size={15} /> },
    { id: 'categories',  label: 'Categories',    icon: <Archive size={15} /> },
    { id: 'data',        label: 'Data & Backup', icon: <Download size={15} /> },
    { id: 'sync',        label: 'Cloud Sync',    icon: <RefreshCw size={15} /> },
  ];

  return (
    <div className="wp-page settings-page">
      <div>
        <div className="section-label" style={{ marginBottom: 2 }}>Settings</div>
        <div className="section-sub">Preferences, currencies, data management and cloud sync.</div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`settings-nav-btn${activeSection === item.id ? ' active' : ''}`}
              onClick={() => setSection(item.id)}
              aria-current={activeSection === item.id ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeSection === 'preferences' && <PreferencesSection />}
          {activeSection === 'currencies'  && <CurrenciesSection />}
          {activeSection === 'categories'  && <CategoriesSection />}
          {activeSection === 'data'        && <DataBackupSection />}
          {activeSection === 'sync'        && <CloudSyncSection />}

          <div className="wp-card settings-about">
            <a href="https://r2dsolutions.com" target="_blank" rel="noopener noreferrer" className="settings-about-brand">
              <img src="https://extensions.r2dsolutions.com/logo.png" alt="R2DSolutions logo" className="settings-about-logo" />
              <div>
                <div className="settings-about-name">R2DSolutions</div>
                <div className="settings-about-tagline">Requirement to Development</div>
              </div>
            </a>
            <p className="text-muted text-sm" style={{ marginTop: '0.75rem' }}>
              WealthPulse is designed and built by{' '}
              <a href="https://r2dsolutions.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)' }}>
                R2DSolutions
              </a>
              . A personal finance tracker to help you track net worth, plan for FIRE, and achieve financial independence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
