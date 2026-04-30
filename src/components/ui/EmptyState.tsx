import type { ComponentType, ReactNode } from 'react';
import { Button } from '../catalyst/button';
import { cn } from '../../utils/cn';
import { EmptyIllustration } from './EmptyIllustration';

type Variant = 'default' | 'inline';
type IllustrationKey = 'empty-list' | 'empty-inbox' | 'empty-cycle';

interface Props {
  icon?: ComponentType<{ size?: number | string; className?: string }>;
  illustration?: IllustrationKey;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  /** default = 페이지 중앙 풀 파드 / inline = 리스트 안 점선 박스 */
  variant?: Variant;
  className?: string;
}

export function EmptyState({
  icon: Icon, illustration, title, description, action, actionLabel, onAction, compact,
  variant = 'default', className,
}: Props) {
  const btn = action ?? (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);

  const wrapper = variant === 'inline'
    ? 'rounded-xl border border-dashed border-gray-010 bg-white'
    : '';

  const pad = compact ? 'py-6' : variant === 'inline' ? 'py-10' : 'py-16';

  return (
    <div className={cn('flex flex-col items-center justify-center text-center', wrapper, pad, className)}>
      {illustration ? (
        <div className="mb-3">
          <EmptyIllustration variant={illustration} size={80} />
        </div>
      ) : Icon && (
        <div className="size-12 bg-gray-010 rounded-xl flex items-center justify-center mb-3">
          <Icon size={20} className="text-fg-subtlest" />
        </div>
      )}
      <p className="text-base/6 font-semibold text-gray-080 mb-1">{title}</p>
      {description && (
        <div className="text-base/6 text-fg-subtle mb-5 max-w-xs">{description}</div>
      )}
      {btn && (
        <Button color="dark/zinc" onClick={btn.onClick}>
          {btn.label}
        </Button>
      )}
    </div>
  );
}
