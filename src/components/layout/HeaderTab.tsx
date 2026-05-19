/**
 * P1-C3 라운드 14 — 공통 Tab 컴포넌트로 wrap.
 * 자체 구현 제거. count badge 등 부가 기능은 Tab 컴포넌트가 흡수.
 */
import type { ReactNode } from 'react';
import { Tab } from '../ui/Tab';

interface HeaderTabProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function HeaderTab({ active, onClick, children }: HeaderTabProps) {
  return <Tab active={active} onClick={onClick}>{children}</Tab>;
}
