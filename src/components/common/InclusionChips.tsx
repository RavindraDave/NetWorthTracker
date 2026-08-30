import React, { useRef } from 'react';
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
}

export const InclusionChips: React.FC<InclusionChipsProps> = ({ value, onChange }) => {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = STATES.indexOf(value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const nextIndex = (index + dir + STATES.length) % STATES.length;
    onChange(STATES[nextIndex]);
    btnRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className="incl-chips"
      role="radiogroup"
      aria-label="Inclusion state"
    >
      {STATES.map((s, index) => {
        const def = CHIPS[s];
        const active = value === s;
        return (
          <button
            key={s}
            ref={el => { btnRefs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={def.title}
            title={def.title}
            tabIndex={index === activeIndex ? 0 : -1}
            className={`incl-chip${active ? ` incl-active ${def.colorClass}` : ''}`}
            onClick={() => onChange(s)}
            onKeyDown={e => handleKeyDown(e, index)}
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
