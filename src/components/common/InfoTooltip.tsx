import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Info } from 'lucide-react';
import './InfoTooltip.css';

interface InfoTooltipProps {
  body: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ body }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.left + rect.width / 2 });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
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
          style={{ top: pos.top, left: pos.left }}
        >
          {body}
        </span>,
        document.body
      )}
    </span>
  );
};
