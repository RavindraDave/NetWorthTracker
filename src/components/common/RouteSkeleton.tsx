import React from 'react';

export const RouteSkeleton: React.FC = () => (
  <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
    {[1, 2, 3].map(i => (
      <div
        key={i}
        className="glass-card"
        style={{
          marginBottom: '1.5rem',
          height: i === 1 ? '180px' : '120px',
          background: 'var(--bg-tertiary)',
          animation: 'skeleton-pulse 1.5s ease-in-out infinite',
          opacity: 1 - i * 0.2,
        }}
      />
    ))}
    <style>{`
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.7; }
      }
    `}</style>
  </div>
);
