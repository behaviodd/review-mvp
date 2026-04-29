import { NavLink } from 'react-router-dom';
import { CATEGORIES, pagesInCategory, pageHref } from '../../guide-content';
import { cn } from '../../utils/cn';

interface Props {
  /** 모바일에서 카테고리/페이지 클릭 시 닫기 콜백 (drawer 모드용). 데스크탑에서는 noop. */
  onItemClick?: () => void;
}

/**
 * 가이드 좌측 네비게이션.
 * - 카테고리별로 grouping
 * - 카테고리 자체는 비클릭 (장식 + 그룹핑 라벨 역할)
 *   카테고리에 속한 첫 페이지로 이동하려면 카테고리 카드(/guide 인덱스) 사용
 * - 페이지 항목은 active 상태 highlight
 */
export function GuideSidebar({ onItemClick }: Props) {
  return (
    <nav className="flex flex-col gap-4 py-4">
      <NavLink
        to="/guide"
        end
        onClick={onItemClick}
        className={({ isActive }) => cn(
          'flex items-center px-4 py-2 text-xs font-semibold tracking-[-0.3px] transition-colors',
          isActive ? 'text-fg-brand1' : 'text-fg-subtle hover:text-fg-default',
        )}
      >
        ← 가이드 홈
      </NavLink>

      {CATEGORIES.map(cat => {
        const pages = pagesInCategory(cat.slug);
        if (pages.length === 0) return null;
        return (
          <div key={cat.slug}>
            <div className="px-5 pb-2 text-xs font-semibold text-fg-subtlest tracking-[-0.3px] leading-4">
              {cat.title}
            </div>
            {pages.map(page => (
              <div key={page.slug} className="px-2">
                <NavLink
                  to={pageHref(page)}
                  onClick={onItemClick}
                  className={({ isActive }) => cn(
                    'flex items-center px-3 py-2 rounded-md text-sm leading-5 tracking-[-0.3px] transition-colors',
                    isActive
                      ? 'bg-bg-token-brand1-subtlest text-fg-brand1 font-bold'
                      : 'text-fg-subtle hover:bg-interaction-hovered font-medium',
                  )}
                >
                  {page.title}
                </NavLink>
              </div>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
