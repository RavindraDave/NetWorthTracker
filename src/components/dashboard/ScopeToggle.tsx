import React from 'react';
import { useApp } from '../../context/AppContext';
import { ViewMode } from '../../utils/calculations';
import './ScopeToggle.css';

const SCOPE_HELP = 'Overall = every tracked item. Liquid = cash & marketable securities. Investable = excludes home equity & personal property.';

export const ScopeToggle: React.FC = () => {
  const { viewMode, setViewMode } = useApp();

  const opts: { id: ViewMode; label: string }[] = [
    { id: 'overall',    label: 'Overall' },
    { id: 'liquid',     label: 'Liquid' },
    { id: 'investable', label: 'Investable' },
  ];

  return (
    <div className="scope-toggle">
      <div className="scope-track" role="radiogroup" aria-label="Net worth view">
        {opts.map(o => (
          <button
            key={o.id}
            role="radio"
            aria-checked={viewMode === o.id}
            className={`scope-btn${viewMode === o.id ? ' scope-active' : ''}`}
            onClick={() => setViewMode(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="scope-info" data-tip={SCOPE_HELP} role="img" aria-label={SCOPE_HELP}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </div>
    </div>
  );
};
