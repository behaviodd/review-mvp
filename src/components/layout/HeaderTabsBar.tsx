import { usePageHeader } from '../../contexts/PageHeaderContext';

/**
 * Phase D-2.3: Header 에 붙은 Tab strip (Figma `ADM / Header / Tab` 정합).
 *
 * usePageHeader() 의 tabs / tabActions 슬롯을 받아 렌더.
 * 슬롯이 비어있으면 자체적으로 null 반환 — 페이지에서 useSetPageHeader 시
 * tabs 를 안 넘기면 Tab strip 자체가 안 보임.
 *
 * 위치: Header (h-92) 다음. flex-col 의 자연 흐름 — sticky 불필요.
 *
 * 모바일은 일단 hidden — 모바일 디자인 별도 phase 에서 정의.
 */
export function HeaderTabsBar() {
  const { tabs, tabActions } = usePageHeader();
  if (!tabs && !tabActions) return null;
  return (
    <div className="hidden md:flex h-[44px] bg-bg-token-default border-b border-bd-default items-center gap-6 px-6 flex-shrink-0">
      <div className="flex items-center gap-6 flex-1 min-w-0">{tabs}</div>
      {tabActions && (
        <div className="flex items-center gap-1.5 flex-shrink-0">{tabActions}</div>
      )}
    </div>
  );
}
