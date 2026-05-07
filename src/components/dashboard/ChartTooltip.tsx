import React from 'react';
import { TooltipProps } from 'recharts';
import { formatCompactNumber } from '../../utils/numberFormat';

interface ChartTooltipProps extends TooltipProps<number, string> {
  showPercentage?: boolean;
  usePayloadName?: boolean;
  showSign?: boolean;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  showPercentage = false,
  usePayloadName = false,
  showSign = false,
}) => {
  if (!active || !payload?.length) return null;
  const tooltipLabel = usePayloadName ? payload[0]?.payload?.fullName ?? payload[0]?.payload?.name : label;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{tooltipLabel}</p>
      {payload.map((p, i) => {
        const val = p.value as number;
        const prefix = showSign && val > 0 ? '+' : '';
        return (
          <p key={i} style={{ color: p.color ?? (p.fill as string) }} className="chart-tooltip__value">
            {p.name ? `${p.name}: ` : ''}
            {prefix}{formatCompactNumber(val)}
            {showPercentage && p.payload?.percentage != null
              ? ` (${(p.payload.percentage as number).toFixed(1)}%)`
              : ''}
          </p>
        );
      })}
    </div>
  );
};
