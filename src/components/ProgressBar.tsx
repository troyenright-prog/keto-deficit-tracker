interface ProgressBarProps {
  value: number;
  max: number;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  label?: string;
  showValues?: boolean;
  unit?: string;
  decimals?: number;
}

export function ProgressBar({
  value,
  max,
  variant = 'default',
  label,
  showValues = true,
  unit = '',
  decimals = 0,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fmt = (n: number) => n.toFixed(decimals);

  return (
    <div className="progress-bar-wrap">
      {label && (
        <div className="progress-bar-header">
          <span className="progress-bar-label">{label}</span>
          {showValues && (
            <span className="progress-bar-values">
              {fmt(value)}{unit} / {fmt(max)}{unit}
            </span>
          )}
        </div>
      )}
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill progress-bar-fill--${variant}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
