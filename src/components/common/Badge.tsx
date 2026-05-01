import React from 'react';

type BadgeVariant = 'default' | 'positive' | 'negative' | 'blue' | 'purple' | 'orange';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default:  { background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' },
  positive: { background: 'rgba(74, 222, 128, 0.1)',  color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' },
  negative: { background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' },
  blue:     { background: 'rgba(59, 130, 246, 0.1)',  color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' },
  purple:   { background: 'rgba(168, 85, 247, 0.1)',  color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' },
  orange:   { background: 'rgba(251, 146, 60, 0.1)',  color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' },
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '', style }) => (
  <span
    className={className}
    style={{
      ...variantStyles[variant],
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {children}
  </span>
);
