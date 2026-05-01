import React from 'react';
import { TooltipProps } from 'recharts';
import { formatCompactNumber } from '../../utils/numberFormat';

interface ChartTooltipProps extends TooltipProps<number, string> {
  showPercentage?: boolean;
  usePayloadName?: boolean;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  showPercentage = false,
  usePayloadName = false,
}) => {
  if (!active || !payload?.length) return null;
  const tooltipLabel = usePayloadName ? payload[0]?.payload?.name : label;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{tooltipLabel}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? (p.fill as string) }} className="chart-tooltip__value">
          {p.name ? `${p.name}: ` : ''}
          {formatCompactNumber(p.value as number)}
          {showPercentage && p.payload?.percentage != null
            ? ` (${(p.payload.percentage as number).toFixed(1)}%)`
            : ''}
        </p>
      ))}
    </div>
  );
};
