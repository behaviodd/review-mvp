import { cn } from './cn';

interface Props {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md';
  color?: 'primary' | 'success' | 'danger' | 'auto';
}

const FILL = {
  primary: 'bg-indigo-600',
  success: 'bg-emerald-500',
  danger:  'bg-red-500',
};

export function ProgressBar({ value, max = 100, label, showPercent, size = 'md', color = 'auto' }: Props) {
  const pct  = Math.min(Math.max((value / max) * 100, 0), 100);
  const auto = pct >= 80 ? FILL.success : pct >= 40 ? FILL.primary : FILL.danger;
  const fill = color === 'auto' ? auto : FILL[color];
  const h    = size === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label       && <span className="text-xs/5 text-zinc-600">{label}</span>}
          {showPercent && <span className="text-xs/5 font-medium text-zinc-700">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-zinc-200 rounded-full overflow-hidden', h)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', fill)}
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
