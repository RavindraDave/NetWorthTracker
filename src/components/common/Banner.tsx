import React from 'react';

type BannerVariant = 'info' | 'warning' | 'error';

const VARIANT_VARS: Record<BannerVariant, { bg: string; border: string; icon: string }> = {
  info:    { bg: 'var(--accent)',               border: 'var(--accent)',               icon: 'var(--accent-text)' },
  warning: { bg: 'var(--accent-yellow, #f59e0b)', border: 'var(--accent-yellow, #f59e0b)', icon: 'var(--accent-yellow, #f59e0b)' },
  error:   { bg: 'var(--accent-red, #dc2626)',   border: 'var(--accent-red, #dc2626)',   icon: 'var(--accent-red, #dc2626)' },
};

interface BannerProps {
  variant?: BannerVariant;
  icon: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const Banner: React.FC<BannerProps> = ({ variant = 'info', icon, children, actions }) => {
  const v = VARIANT_VARS[variant];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.65rem 1rem',
      marginBottom: '1rem',
      borderRadius: 'var(--radius-md)',
      background: `color-mix(in srgb, ${v.bg} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${v.border} 40%, transparent)`,
      flexWrap: 'wrap',
    }}>
      <span style={{ color: v.icon, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {icon}
      </span>
      <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
        {children}
      </span>
      {actions && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  );
};
