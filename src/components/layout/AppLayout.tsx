import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Star, Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import { ToastContainer } from '../ui/Toast';

// 전체 창을 사용하는 풀블리드 레이아웃이 필요한 경로 prefix
const FULL_BLEED_PATHS = ['/reviews/team/', '/reviews/me/', '/feedback'];

export function AppLayout() {
  const { currentUser } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!currentUser) return <Navigate to="/login" replace />;

  const isFullBleed = FULL_BLEED_PATHS.some(p => location.pathname.startsWith(p));

  return (
    <div className="flex min-h-screen bg-neutral-100">
      {/* 모바일 백드롭 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${collapsed ? 'md:ml-14' : 'md:ml-56'}`}>

        {/* 모바일 전용 상단 바 */}
        <div className="md:hidden bg-neutral-950 border-b border-white/5 h-12 flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center">
              <Star size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">ReviewFlow</span>
          </div>
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="메뉴 열기"
          >
            <Menu size={18} />
          </button>
        </div>

        <main className={`flex-1 flex flex-col ${isFullBleed ? 'overflow-hidden' : 'p-4 md:p-6'}`}>
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
    </div>
  );
}
