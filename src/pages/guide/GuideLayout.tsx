import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { GuideSidebar } from './GuideSidebar';
import { MsMenuIcon, MsCancelIcon } from '../../components/ui/MsIcons';

/**
 * 가이드 전용 레이아웃 — `/guide/*` 라우트에서 사용.
 *
 * 데스크탑: 좌측 240px 고정 사이드바 + 본문 (max 760px)
 * 모바일: 사이드바를 drawer 로 전환, 본문이 풀폭
 */
export function GuideLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useSetPageHeader('가이드', undefined, { subtitle: '리뷰시스템 사용 안내' });

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:block w-[240px] flex-shrink-0 border-r border-bd-default bg-bg-token-default overflow-y-auto">
        <GuideSidebar />
      </aside>

      {/* 모바일 drawer */}
      {mobileSidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-30"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="md:hidden fixed left-0 top-0 bottom-0 w-[260px] bg-bg-token-default border-r border-bd-default z-40 overflow-y-auto">
            <div className="flex justify-end px-3 py-3">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="text-fg-subtle hover:text-fg-default"
                aria-label="닫기"
              >
                <MsCancelIcon size={20} />
              </button>
            </div>
            <GuideSidebar onItemClick={() => setMobileSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* 본문 — 가이드 페이지 */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* 모바일 전용 목차 토글 */}
        <div className="md:hidden flex items-center px-4 py-3 border-b border-bd-default bg-bg-token-default sticky top-0 z-10">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex items-center gap-2 text-sm font-semibold text-fg-subtle"
          >
            <MsMenuIcon size={16} />
            목차
          </button>
        </div>

        <div className="mx-auto max-w-[760px] px-6 md:px-8 py-8 md:py-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
