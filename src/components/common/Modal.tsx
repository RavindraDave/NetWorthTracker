import React, { useEffect, useRef } from 'react';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  contentStyle?: React.CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const FOCUSABLE = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  children,
  onClose,
  className = '',
  contentStyle,
  ...aria
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = Array.from(
        el.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter(x => !(x as HTMLButtonElement).disabled);
      if (!els.length) return;
      if (e.shiftKey) {
        if (document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus(); }
      } else {
        if (document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus(); }
      }
    };

    el.addEventListener('keydown', trap);
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    return () => {
      el.removeEventListener('keydown', trap);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={contentRef}
        className={`modal-content glass-card ${className}`}
        role="dialog"
        aria-modal="true"
        style={contentStyle}
        {...aria}
      >
        {children}
      </div>
    </div>
  );
};
