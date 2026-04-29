import { Link, Navigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { adjacentPages, findCategory, findPage, pageHref } from '../../guide-content';

// Vite: 카테고리 폴더 안 모든 .md 파일을 raw 문자열로 일괄 로드.
// eager: true → 빌드 시점에 인라인 (런타임 fetch 없음, 캐시 단순)
const markdownByPath = import.meta.glob<string>('../../guide-content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function loadMarkdown(category: string, slug: string): string | null {
  const key = `../../guide-content/${category}/${slug}.md`;
  return markdownByPath[key] ?? null;
}

export function GuidePage() {
  const { category, slug } = useParams<{ category: string; slug: string }>();
  if (!category || !slug) return <Navigate to="/guide" replace />;

  const page = findPage(category, slug);
  const cat = findCategory(category);
  if (!page || !cat) return <Navigate to="/guide" replace />;

  const md = loadMarkdown(category, slug);
  const { prev, next } = adjacentPages(page);

  return (
    <article>
      {/* 브레드크럼 */}
      <nav className="text-xs text-fg-subtlest tracking-[-0.3px] leading-4">
        <Link to="/guide" className="hover:text-fg-default transition-colors">가이드</Link>
        <span className="mx-1.5">/</span>
        <span>{cat.title}</span>
      </nav>

      {/* 제목 + 요약 */}
      <h1 className="mt-2 text-2xl font-bold text-fg-default tracking-[-0.3px] leading-9">
        {page.title}
      </h1>
      <p className="mt-2 text-sm text-fg-subtle leading-6 tracking-[-0.3px]">
        {page.summary}
      </p>

      {/* 본문 — Tailwind typography 미사용. 직접 prose 스타일 적용 */}
      <div className="mt-8 guide-prose">
        {md ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        ) : (
          <p className="text-sm text-fg-subtlest">본문이 아직 작성되지 않았습니다.</p>
        )}
      </div>

      {/* 이전/다음 네비 */}
      <div className="mt-12 pt-6 border-t border-bd-default grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prev ? (
          <Link
            to={pageHref(prev)}
            className="block rounded-lg border border-bd-default p-4 hover:bg-interaction-hovered transition-colors"
          >
            <p className="text-xs text-fg-subtlest tracking-[-0.3px] leading-4">← 이전</p>
            <p className="mt-1 text-sm font-bold text-fg-default tracking-[-0.3px] leading-5">{prev.title}</p>
          </Link>
        ) : <div />}
        {next ? (
          <Link
            to={pageHref(next)}
            className="block rounded-lg border border-bd-default p-4 hover:bg-interaction-hovered transition-colors text-right"
          >
            <p className="text-xs text-fg-subtlest tracking-[-0.3px] leading-4">다음 →</p>
            <p className="mt-1 text-sm font-bold text-fg-default tracking-[-0.3px] leading-5">{next.title}</p>
          </Link>
        ) : <div />}
      </div>
    </article>
  );
}
