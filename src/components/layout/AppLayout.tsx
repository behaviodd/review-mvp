import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { MsMenuIcon } from '../ui/MsIcons';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { HeaderTabsBar } from './HeaderTabsBar';
import { useAuthStore } from '../../stores/authStore';
import { ToastContainer, useShowToast } from '../ui/Toast';
import { PageHeaderProvider } from '../../contexts/PageHeaderContext';
import { SyncStatusBanner } from '../system/SyncStatusBanner';
import { ImpersonationBanner } from '../system/ImpersonationBanner';
import { QUOTA_EVENT } from '../../utils/safeStorage';

const FULL_BLEED_PATHS = ['/reviews/team/', '/reviews/me/', '/feedback', '/templates/'];
// FULL_BLEED 매칭이 prefix 기반이어서 의도치 않게 포함되는 라우트의 예외 목록.
// 이 목록에 들어오는 경로는 일반 컨테이너(max-w-5xl + p-6)로 렌더된다.
const FULL_BLEED_EXCLUDE = ['/reviews/team/peer-approvals'];
// Phase D-2.4c: 정확 매칭 full-bleed 경로 — 좌우 패널 개별 스크롤 등을 위해
// 페이지가 자체 height 관리하는 라우트. prefix 가 아닌 정확 매칭만.
const FULL_BLEED_EXACT = ['/team'];

export function AppLayout() {
  const { currentUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const showToast = useShowToast();

  // localStorage 용량 초과 시 사용자에게 한 번 알림
  useEffect(() => {
    const onQuota = () => {
      showToast('error', '브라우저 저장소가 가득 찼어요. 오래된 데이터를 비우거나 다른 브라우저를 사용해 주세요.');
    };
    window.addEventListener(QUOTA_EVENT, onQuota);
    return () => window.removeEventListener(QUOTA_EVENT, onQuota);
  }, [showToast]);

  if (!currentUser) return <Navigate to="/login" replace />;

  const isFullBleed =
    (FULL_BLEED_PATHS.some(p => location.pathname.startsWith(p)) &&
     !FULL_BLEED_EXCLUDE.includes(location.pathname))
    || FULL_BLEED_EXACT.includes(location.pathname);
  // R7 prep: Sidebar 접기 제거 — 데스크탑 고정 220px
  const sidebarWidth = 'md:ml-[220px]';

  return (
    <PageHeaderProvider>
    {/* Phase D-1.1: raw bg-gray-005 제거 — body 가 이미 var(--token-bg-subtle = #f8f9fa) 깔고 있어 중복.
        토큰 단일 출처로 통일 + 페이지 배경 톤이 Figma Color/Bg/Primary 와 정합 */}
    <div className="flex h-screen overflow-hidden">
      {/* 모바일 백드롭 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-200 ${sidebarWidth}`}>

        {/* 모바일 전용 상단 바 */}
        <div className="md:hidden bg-white border-b border-gray-020 h-[56px] flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-20">
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
            <span className="text-sm font-semibold text-gray-099">메이크스타 리뷰시스템</span>
          </div>
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="p-1.5 rounded-lg text-gray-050 hover:text-gray-099 hover:bg-gray-010 transition-colors"
            aria-label="메뉴 열기"
          >
            <MsMenuIcon size={16} />
          </button>
        </div>

        {/* 데스크탑 헤더 */}
        <div className="hidden md:block">
          <Header />
        </div>

        {/* Phase D-2.3: 헤더에 붙은 Tab strip — usePageHeader 의 tabs/tabActions 슬롯이
            있을 때만 자동 렌더 (없으면 null). 페이지 1차 분류용. */}
        <HeaderTabsBar />

        <ImpersonationBanner />
        <SyncStatusBanner />

        <main className={`flex-1 flex flex-col min-h-0 ${isFullBleed ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
          {isFullBleed ? (
            <Outlet />
          ) : (
            // R7 prep: 콘텐츠 영역 확장 — max-w-5xl 제한 제거.
            // 화면 가로를 가득 활용하되 매우 큰 모니터(>1920)에서만 부드럽게 캡(2560px ≒ max-w-screen-2xl 더 위).
            <div className="w-full mx-auto max-w-[1920px]">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      <ToastContainer />
    </div>
    </PageHeaderProvider>
  );
}
