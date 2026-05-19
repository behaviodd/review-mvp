/**
 * P1-C1 라운드 14 — DS SegmentControl 패턴.
 * 기존: ListToolbar 의 SegmentPills + OpsFilterBar 의 Segment 자체 구현 2종 (동일 패턴).
 * 본 컴포넌트로 통일.
 *
 * DS 패턴:
 *   size: sm (h-6) / md (h-7, 기본) / lg (h-8)
 *   fullWidth: true 면 flex-1 로 폭 균등 분배
 *   options 의 count 는 선택사항 (SegmentPills 기능 흡수)
 *   role: tablist (단일 선택)
 */
import { cn } from '../../utils/cn';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  hint?: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  ariaLabel?: string;
  /** 호환용 — 외부 컨테이너 정렬 등 */
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-7 px-2.5 text-base',
  lg: 'h-8 px-3 text-base',
} as const;

export function SegmentControl<T extends string>({
  value, onChange, options, size = 'md', fullWidth, ariaLabel, className,
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex rounded-xl bg-surface-sunken p-1 gap-1',
        fullWidth && 'w-full',
        className,
      )}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1 rounded-lg tracking-[-0.3px] leading-5 transition-colors whitespace-nowrap',
              SIZE_CLASSES[size],
              fullWidth && 'flex-1 justify-center',
              active
                ? 'bg-surface-default text-fg-default font-bold shadow-[0_2px_4px_rgba(76,90,102,0.16)]'
                : 'text-fg-subtle font-semibold hover:text-fg-default',
            )}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span className="text-xs tabular-nums opacity-70">{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
