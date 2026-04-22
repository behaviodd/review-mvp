import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const PAGE_TITLES: Record<string, string> = {
  '/':              '홈',
  '/reviews/me':    '내 리뷰',
  '/reviews/team':  '하향 평가',
  '/team':          '구성원',
  '/cycles':        '리뷰 운영',
  '/settings':      '설정',
  '/cycles/new':    '리뷰 사이클 생성',
};

export function Header() {
  const { currentUser } = useAuthStore();
  const location = useLocation();

  if (!currentUser) return null;

  const pageTitle = PAGE_TITLES[location.pathname] ?? '';

  return (
    <header className="h-[72px] bg-white border-b border-gray-200 flex items-center px-6 sticky top-0 z-10">
      {pageTitle && (
        <h1 className="text-base font-semibold text-gray-900">{pageTitle}</h1>
      )}
    </header>
  );
}
