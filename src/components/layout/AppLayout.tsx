import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '../../stores/authStore';
import { ToastContainer } from '../ui/Toast';
import { ChangePasswordModal } from '../common/ChangePasswordModal';
import { PageHeaderProvider } from '../../contexts/PageHeaderContext';

const FULL_BLEED_PATHS = ['/reviews/team/', '/reviews/me/', '/feedback', '/templates/'];

export function AppLayout() {
  const { currentUser, mustChangePassword } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!currentUser) return <Navigate to="/login" replace />;

  const isFullBleed = FULL_BLEED_PATHS.some(p => location.pathname.startsWith(p));
  const sidebarWidth = collapsed ? 'md:ml-[56px]' : 'md:ml-[220px]';

  return (
    <PageHeaderProvider>
    <div className="flex min-h-screen bg-[#F3F4F6]">
      {/* 모바일 백드롭 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${sidebarWidth}`}>

        {/* 모바일 전용 상단 바 */}
        <div className="md:hidden bg-white border-b border-gray-200 h-[56px] flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <svg className="size-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#ms-mob-clip)">
                <path d="M0 6.4C0 4.15979 0 3.03968 0.435974 2.18404C0.819467 1.43139 1.43139 0.819467 2.18404 0.435974C3.03968 0 4.15979 0 6.4 0H17.6C19.8402 0 20.9603 0 21.816 0.435974C22.5686 0.819467 23.1805 1.43139 23.564 2.18404C24 3.03968 24 4.15979 24 6.4V17.6C24 19.8402 24 20.9603 23.564 21.816C23.1805 22.5686 22.5686 23.1805 21.816 23.564C20.9603 24 19.8402 24 17.6 24H6.4C4.15979 24 3.03968 24 2.18404 23.564C1.43139 23.1805 0.819467 22.5686 0.435974 21.816C0 20.9603 0 19.8402 0 17.6V6.4Z" fill="url(#ms-mob-grad)"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M20.3158 10.8307L18.0583 9.51837C17.4989 9.19275 17.1593 8.60071 17.1593 7.95933V5.35436C17.1593 4.30843 16.0205 3.65718 15.1115 4.19002L12.904 5.47277C12.3446 5.79839 11.6454 5.79839 11.076 5.47277L8.87847 4.19002C7.96948 3.66705 6.83074 4.31829 6.83074 5.35436V7.95933C6.83074 8.60071 6.49112 9.19275 5.93174 9.51837L3.67425 10.8307C2.77525 11.3537 2.77525 12.6463 3.67425 13.1693L5.93174 14.4816C6.49112 14.8073 6.83074 15.3993 6.83074 16.0407V18.6456C6.83074 19.6916 7.96948 20.3428 8.87847 19.81L11.086 18.5272C11.6454 18.2016 12.3446 18.2016 12.914 18.5272L15.1215 19.81C16.0305 20.3329 17.1693 19.6817 17.1693 18.6456V16.0407C17.1693 15.3993 17.5089 14.8073 18.0683 14.4816L20.3257 13.1693C21.2247 12.6463 21.2247 11.3537 20.3257 10.8307H20.3158ZM17.1493 12.5772L15.5511 13.5048C15.2614 13.6725 15.0816 13.9883 15.0816 14.3238V16.1788C15.0816 16.6919 14.5122 17.0175 14.0627 16.7511L12.4845 15.8335C12.1848 15.6657 11.8252 15.6657 11.5255 15.8335L9.94728 16.7412C9.48779 17.0077 8.91842 16.682 8.91842 16.1591V14.304C8.91842 13.9685 8.73862 13.6626 8.44895 13.4949L6.85072 12.5674C6.40122 12.3108 6.40122 11.6596 6.85072 11.403L8.44895 10.4755C8.73862 10.3078 8.91842 9.992 8.91842 9.65651V7.81132C8.91842 7.28836 9.48779 6.9726 9.94728 7.22915L11.5255 8.13695C11.8252 8.30469 12.1848 8.30469 12.4845 8.13695L14.0627 7.22915C14.5222 6.96274 15.0916 7.28836 15.0916 7.81132V9.66638C15.0916 10.0019 15.2714 10.3078 15.561 10.4755L17.1593 11.403C17.6088 11.6596 17.6088 12.3108 17.1593 12.5674L17.1493 12.5772Z" fill="white"/>
              </g>
              <defs>
                <radialGradient id="ms-mob-grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24.5 24) rotate(-135) scale(33.9411)">
                  <stop stopColor="#FDAA87"/>
                  <stop offset="0.802885" stopColor="#FF558F"/>
                </radialGradient>
                <clipPath id="ms-mob-clip"><rect width="24" height="24" fill="white"/></clipPath>
              </defs>
            </svg>
            <span className="text-sm font-semibold text-gray-900">ReviewFlow</span>
          </div>
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="메뉴 열기"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* 데스크탑 헤더 */}
        <div className="hidden md:block">
          <Header />
        </div>

        <main className={`flex-1 flex flex-col ${isFullBleed ? 'overflow-hidden' : 'p-6'}`}>
          {isFullBleed ? (
            <Outlet />
          ) : (
            <div className="w-full max-w-5xl mx-auto">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      <ToastContainer />

      {mustChangePassword && (
        <ChangePasswordModal userId={currentUser.id} onDone={() => {}} />
      )}
    </div>
    </PageHeaderProvider>
  );
}
