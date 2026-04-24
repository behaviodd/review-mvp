import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type PillTone =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'purple';

export type PillSize = 'xs' | 'sm' | 'md';

interface Props {
  tone?: PillTone;
  size?: PillSize;
  children: ReactNode;
  leftIcon?: ReactNode;
  className?: string;
  title?: string;
}

const TONE: Record<PillTone, string> = {
  neutral: 'bg-gray-005  text-gray-070  border-gray-010',
  brand:   'bg-pink-005  text-pink-060  border-pink-010',
  info:    'bg-blue-005  text-blue-070  border-blue-020',
  success: 'bg-green-005 text-green-070 border-green-020',
  warning: 'bg-orange-005 text-orange-070 border-orange-020',
  danger:  'bg-red-005   text-red-070   border-red-020',
  purple:  'bg-purple-005 text-purple-060 border-purple-010',
};

const SIZE: Record<PillSize, string> = {
  xs: 'h-5   px-1.5 text-[10px]',
  sm: 'h-6   px-2   text-[11px]',
  md: 'h-7   px-2.5 text-xs',
};

export function Pill({
  tone = 'neutral',
  size = 'sm',
  children,
  leftIcon,
  className,
  title,
}: Props) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
        TONE[tone],
        SIZE[size],
        className,
      )}
    >
      {leftIcon}
      {children}
    </span>
  );
}
