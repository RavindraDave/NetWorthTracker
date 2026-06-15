import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Info } from 'lucide-react';
import './InfoTooltip.css';

interface InfoTooltipProps {
  body: React.ReactNode;
}

const TOOLTIP_HEIGHT_ESTIMATE = 90; // px — used only to decide flip direction

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ body }) => {
  const [open, setOpen]   = useState(false);
  const [pos, setPos]     = useState({ top: 0, left: 0 });
  const [below, setBelow] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Clamp left so the 220px popover never overflows left/right edge
      const centerX = Math.max(118, Math.min(rect.left + rect.width / 2, window.innerWidth - 118));
      // Flip below when there isn't enough room above the trigger
      const flip = rect.top < TOOLTIP_HEIGHT_ESTIMATE + 16;
      setBelow(flip);
      setPos({ top: flip ? rect.bottom : rect.top, left: centerX });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onKey  = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <span className="info-tooltip-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="info-tooltip-trigger"
        aria-label="More information"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <Info size={13} />
      </button>
      {open && ReactDOM.createPortal(
        <span
          role="tooltip"
          className="info-tooltip-popover"
          data-below={below || undefined}
          style={{ top: pos.top, left: pos.left }}
        >
          {body}
        </span>,
        document.body
      )}
    </span>
  );
};
