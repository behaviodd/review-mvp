import { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../catalyst/avatar';
import { Divider } from '../catalyst/divider';
import { NotificationPanel } from '../common/NotificationPanel';

const ROLE_LABEL: Record<string, string> = {
  admin:  '관리자',
  leader: '조직장',
  member: '팀원',
};

const PAGE_TITLES: Record<string, string> = {
  '/':              '홈',
  '/reviews/me':    '내 리뷰',
  '/reviews/team':  '하향 평가',
  '/team':          '구성원',
  '/cycles':        '리뷰 운영',
  '/settings':      '설정',
  '/cycles/new':    '리뷰 사이클 생성',
};

interface Props {
  onMobileToggle?: () => void;
}

export function Header({ onMobileToggle: _onMobileToggle }: Props) {
  const { currentUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!currentUser) return null;

  const pageTitle = PAGE_TITLES[location.pathname] ?? '';
  const roleLabel = ROLE_LABEL[currentUser.role] ?? '';

  return (
    <header className="h-[72px] bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">

      {/* 페이지 타이틀 */}
      <div className="flex items-center gap-2">
        {pageTitle && (
          <h1 className="text-base font-semibold text-gray-900">{pageTitle}</h1>
        )}
      </div>

      <div className="flex items-center gap-1">
        <NotificationPanel />

        {/* 유저 드롭다운 */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Avatar
              initials={currentUser.name.slice(0, 2)}
              color={currentUser.avatarColor}
              className="size-7"
            />
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {currentUser.name}
              </p>
              {roleLabel && (
                <p className="text-[11px] text-gray-400 leading-tight">{roleLabel}</p>
              )}
            </div>
            <ChevronDown size={12} className="text-gray-400 hidden sm:block" />
          </button>

          {open && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-56 bg-white rounded-xl shadow-[0_8px_24px_rgb(0,0,0,0.10)] ring-1 ring-gray-200 z-50 overflow-hidden animate-[fadeSlideDown_0.15s_ease]">
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    initials={currentUser.name.slice(0, 2)}
                    color={currentUser.avatarColor}
                    className="size-9"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{currentUser.name}</p>
                    <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
                  </div>
                </div>
              </div>

              <Divider soft />

              <div className="py-1">
                <button
                  onClick={() => { navigate('/settings'); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={14} className="text-gray-400 shrink-0" />
                  설정
                </button>
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} className="shrink-0" />
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
