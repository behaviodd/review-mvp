/**
 * P1-C3 라운드 14 — DS Tab 패턴.
 * 기존: HeaderTab (Header strip) + ListToolbar 안의 tab strip (count badge 포함) 2종.
 * 본 Tab 컴포넌트로 통일. count 는 ListToolbar 패턴 흡수.
 *
 * Figma 정합:
 *   border-b-2 -mb-px + py-2.5 + text-base font-bold tracking-[-0.3px]
 *   active: border-fg-default + text-fg-default
 *   inactive: border-transparent + text-fg-subtle hover:text-fg-default
 *   count badge: active=gray-099/white, inactive=gray-010/gray-030
 */
import { type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface Props {
  active?: boolean;
  count?: number;
  onClick?: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

export function Tab({ active, count, onClick, children, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 py-2.5 -mb-px transition-colors border-b-2 whitespace-nowrap',
        active
          ? 'border-fg-default text-fg-default'
          : 'border-transparent text-fg-subtle hover:text-fg-default',
      )}
    >
      <span className="text-base font-bold tracking-[-0.3px] leading-6">{children}</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'text-xs font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums',
            active ? 'bg-gray-099 text-white' : 'bg-gray-010 text-gray-030',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
