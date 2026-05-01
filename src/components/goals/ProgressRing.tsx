import React, { useEffect, useState } from 'react';
import './ProgressRing.css';

interface ProgressRingProps {
  radius: number;
  stroke: number;
  progress: number; // 0 to 100
  color?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  radius,
  stroke,
  progress,
  color = 'var(--accent-green)',
  backgroundColor = 'rgba(255,255,255,0.05)',
  children
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  
  useEffect(() => {
    // Simple entry animation
    const timeout = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);
    return () => clearTimeout(timeout);
  }, [progress]);

  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;

  return (
    <div className="progress-ring-container" style={{ width: radius * 2, height: radius * 2 }}>
      <svg
        height={radius * 2}
        width={radius * 2}
        className="progress-ring"
      >
        <defs>
          <linearGradient id={`ring-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background track */}
        <circle
          stroke={backgroundColor}
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        
        {/* Progress stroke */}
        <circle
          stroke={`url(#ring-grad-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="progress-ring__circle"
          filter="url(#glow)"
        />
      </svg>
      <div className="progress-ring__content">
        {children}
      </div>
    </div>
  );
};
