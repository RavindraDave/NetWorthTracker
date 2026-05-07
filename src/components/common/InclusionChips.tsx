import React from 'react';
import './InclusionChips.css';

export type InclusionValue = 'full' | 'nwOnly' | 'exclude';

interface ChipDef {
  label: string;
  glyph: string;
  colorClass: string;
  title: string;
}

const CHIPS: Record<InclusionValue, ChipDef> = {
  full: {
    label: 'full',
    glyph: 'Σ✓',
    colorClass: 'incl-accent',
    title: 'Included in net worth & goals',
  },
  nwOnly: {
    label: 'nwOnly',
    glyph: 'Σ',
    colorClass: 'incl-amber',
    title: 'Counted in net worth · excluded from goals',
  },
  exclude: {
    label: 'exclude',
    glyph: '⊘',
    colorClass: 'incl-rose',
    title: 'Excluded from everything',
  },
};

const STATES: InclusionValue[] = ['full', 'nwOnly', 'exclude'];

interface InclusionChipsProps {
  value: InclusionValue;
  onChange: (next: InclusionValue) => void;
  size?: 'sm' | 'lg';
}

export const InclusionChips: React.FC<InclusionChipsProps> = ({ value, onChange, size = 'sm' }) => {
  return (
    <div
      className={`incl-chips incl-chips--${size}`}
      role="radiogroup"
      aria-label="Inclusion state"
    >
      {STATES.map(s => {
        const def = CHIPS[s];
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={def.title}
            title={def.title}
            className={`incl-chip${active ? ` incl-active ${def.colorClass}` : ''}`}
            onClick={() => onChange(s)}
          >
            {def.glyph}
          </button>
        );
      })}
    </div>
  );
};

export function exclusionStateToInclusion(state: 'all' | 'goals-only' | 'everywhere'): InclusionValue {
  if (state === 'everywhere') return 'exclude';
  if (state === 'goals-only') return 'nwOnly';
  return 'full';
}

export function inclusionToExclusionState(value: InclusionValue): 'all' | 'goals-only' | 'everywhere' {
  if (value === 'exclude') return 'everywhere';
  if (value === 'nwOnly') return 'goals-only';
  return 'all';
}
