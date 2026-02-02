import React from 'react';

export interface ProgressBarProps {
  percent: number;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

/**
 * 进度条组件
 */
export const ProgressBar = React.memo<ProgressBarProps>(({
  percent,
  showLabel = true,
  size = 'medium',
  color = 'primary',
  className = ''
}) => {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  const heightClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3'
  };

  const colorClasses = {
    primary: 'bg-accent',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500'
  };

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-tertiary rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300 ease-out`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {showLabel && (
        <div className="text-xs text-muted mt-1 text-right">
          {clampedPercent.toFixed(0)}%
        </div>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';
