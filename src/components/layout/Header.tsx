import { useAuthStore } from '../../stores/authStore';
import { usePageHeader } from '../../contexts/PageHeaderContext';
import { MsChevronLeftLineIcon } from '../ui/MsIcons';
import { cn } from '../ui/cn';

/**
 * Phase D-2.2: Header — Figma 정합
 * - 높이 72 → 92px (Figma node 1143:13782)
 * - 타이틀 text-xl/leading-7 → text-2xl Bold leading-10 (Display/Small 토큰)
 * - 색상 raw 팔레트 → semantic 토큰 (fg/bd)
 * - subtitle 있을 때 title leading 축소 (subtitle 과 함께 92px 안에 수용)
 *
 * Phase D-2.4a-fix: Tab strip 동반 시 border 중복 제거.
 *   tabs/tabActions slot 이 있으면 HeaderTabsBar 에 border-b 가 그어지므로
 *   Header 자체의 border 는 생략 (Figma 정합 — 헤더+탭 조합 시 1px 만).
 */
export function Header() {
  const { currentUser } = useAuthStore();
  const { title, subtitle, actions, onBack, tabs, tabActions } = usePageHeader();

  if (!currentUser) return null;

  const hasTabBar = !!(tabs || tabActions);

  return (
    <header className={cn(
      // Phase D-2.4d: Figma 정합 — Header 는 elevated/surface/default (#ffffff).
      // bg-bg-token-default (페이지 본문) 와 hex 동일하지만 토큰 의미 분리:
      // Header 는 페이지 위 가장 평평한 elevated surface.
      'h-[92px] bg-surface-default flex items-center gap-4 px-6 py-3 sticky top-0 z-10 flex-shrink-0',
      !hasTabBar && 'border-b border-bd-default',
    )}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-interaction-hovered hover:text-fg-default transition-colors"
          aria-label="뒤로"
        >
          <MsChevronLeftLineIcon size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {title && (
          <h1 className={cn(
            'text-2xl font-bold text-fg-default tracking-[-0.3px] truncate',
            subtitle ? 'leading-7' : 'leading-10',
          )}>{title}</h1>
        )}
        {subtitle && (
          <div className="text-xs text-fg-subtlest mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[60%] flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
