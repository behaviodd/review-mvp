import { Link } from 'react-router-dom';
import { CATEGORIES, categoryFirstPageHref, pagesInCategory } from '../../guide-content';

/**
 * `/guide` 인덱스 페이지 — 카테고리 카드 그리드.
 * 카테고리를 클릭하면 해당 카테고리의 첫 페이지로 이동한다.
 * 페이지가 없는 카테고리는 비활성 카드로 표시.
 */
export function GuideIndex() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-fg-default tracking-[-0.3px] leading-9">
        가이드
      </h1>
      <p className="mt-1 text-base text-fg-subtle leading-6 tracking-[-0.3px]">
        리뷰시스템을 처음 쓰시는 분도, 익숙하신 분도 이곳에서 필요한 안내를 찾아보세요.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const href = categoryFirstPageHref(cat);
          const count = pagesInCategory(cat.slug).length;
          const disabled = !href;

          const inner = (
            <>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-md bg-bg-token-brand1-subtlest text-fg-brand1">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-fg-default tracking-[-0.3px] leading-5 truncate">
                    {cat.title}
                  </p>
                  <p className="text-xs text-fg-subtlest tracking-[-0.3px] leading-4 mt-0.5">
                    {count > 0 ? `${count}개 문서` : '준비 중'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-base text-fg-subtle tracking-[-0.3px] leading-5">
                {cat.summary}
              </p>
            </>
          );

          const className = 'block rounded-lg border border-bd-default p-4 transition-colors';
          if (disabled) {
            return (
              <div key={cat.slug} className={`${className} opacity-50 cursor-not-allowed`}>
                {inner}
              </div>
            );
          }
          return (
            <Link
              key={cat.slug}
              to={href!}
              className={`${className} hover:bg-interaction-hovered`}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
