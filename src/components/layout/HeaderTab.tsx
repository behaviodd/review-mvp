import type { ReactNode } from 'react';
import { cn } from '../ui/cn';

/**
 * Phase D-2.3: Tab strip 의 단일 탭 아이템 (Figma `01-TabItem` 정합).
 *
 * Header 에 붙은 Tab strip 안에서 사용 — 페이지 1차 분류 또는 view toggle 용.
 * 콘텐츠 영역 안의 세그먼테이션은 ListToolbar segments 를 사용 (역할 분리).
 *
 * 사용 예:
 *   useSetPageHeader('구성원 관리', actions, {
 *     tabs: (
 *       <>
 *         <HeaderTab active>전체</HeaderTab>
 *         <HeaderTab onClick={...}>대기 승인</HeaderTab>
 *       </>
 *     ),
 *     tabActions: <button ...>필터</button>,
 *   });
 */
interface HeaderTabProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function HeaderTab({ active, onClick, children }: HeaderTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center py-2.5 -mb-px transition-colors border-b-2',
        active
          ? 'border-fg-default text-fg-default'
          : 'border-transparent text-fg-subtle hover:text-fg-default',
      )}
    >
      <span className="text-base font-bold tracking-[-0.3px] leading-6 whitespace-nowrap">
        {children}
      </span>
    </button>
  );
}
