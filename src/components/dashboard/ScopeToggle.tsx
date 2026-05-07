import React from 'react';
import { useApp } from '../../context/AppContext';
import { ViewMode } from '../../utils/calculations';
import { InfoTooltip } from '../common/InfoTooltip';
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
      <InfoTooltip body={SCOPE_HELP} />
    </div>
  );
};
