import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useTeamStore } from './stores/teamStore';
import { useSheetsSyncStore } from './stores/sheetsSyncStore';
import { useOrgSync } from './hooks/useOrgSync';
import { useReviewSync } from './hooks/useReviewSync';
import { retryAll } from './utils/syncQueue';
import { SchedulerTick } from './components/system/SchedulerTick';
import { GlobalSearch } from './components/system/GlobalSearch';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';
import { MyReviewList } from './pages/reviews/MyReviewList';
import { EmptyState } from './components/ui/EmptyState';
import { MyReviewWrite } from './pages/reviews/MyReviewWrite';
import { TeamReviewList } from './pages/reviews/TeamReviewList';
import { TeamReviewWrite } from './pages/reviews/TeamReviewWrite';
import { ProxyWriteRouter } from './pages/reviews/ProxyWriteRouter';
import { PeerPickPage } from './pages/reviews/PeerPickPage';
import { PeerApprovalPage } from './pages/reviews/PeerApprovalPage';
import { ReceivedReviewList } from './pages/reviews/ReceivedReviewList';
import { CycleList } from './pages/reviews/CycleList';
import { CycleNew } from './pages/reviews/CycleNew';
import { CycleDetail } from './pages/reviews/CycleDetail';
import { CycleArchive } from './pages/reviews/CycleArchive';
import { TemplateList } from './pages/reviews/TemplateList';
import { TemplateBuilder } from './pages/reviews/TemplateBuilder';
import { Team } from './pages/Team';
import { Settings } from './pages/Settings';
import { Permissions } from './pages/Permissions';
import { AuditLog } from './pages/AuditLog';

// 로그인 상태일 때만 시트 동기화 실행
function OrgSyncProvider() {
  useOrgSync();
  return null;
}

function ReviewSyncProvider() {
  useReviewSync();
  return null;
}

// 부팅 5초 뒤, 실패 큐가 있으면 1회 자동 재시도
function SyncQueueBootRetry() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const { pendingOps } = useSheetsSyncStore.getState();
      if (pendingOps.length > 0) {
        void retryAll();
      }
    }, 5000);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuthStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuthStore();
  if (currentUser) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { currentUser } = useAuthStore();
  const impersonatingFromId = useAuthStore(s => s.impersonatingFromId);
  const orgUnits = useTeamStore(s => s.orgUnits);
  const isOrgHead = !!currentUser && orgUnits.some(u => u.headId === currentUser.id);
  const effectiveRole = isOrgHead && currentUser.role === 'member' ? 'leader' : currentUser?.role;
  // R6 Phase D: 마스터 로그인 활성 중에는 admin 전용 라우트 접근 차단.
  // currentUser 가 admin role 사용자라도 impersonate 대상자(non-admin)이라 자동 거부되지만,
  // 명시적 가드로 의도 표현.
  if (impersonatingFromId && roles.length === 1 && roles[0] === 'admin') {
    return <Navigate to="/" replace />;
  }
  if (!currentUser || !roles.includes(effectiveRole ?? '')) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/** 각 라우트 element에 적용되는 개별 에러 경계. 한 페이지 에러가 레이아웃 전체로 번지지 않도록 격리한다. */
function RouteBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary scope="page">{children}</ErrorBoundary>;
}

/** /reviews/me: admin은 자기평가 대상이 아니므로 사이클 목록으로 안내 */
function MyReviewsOrAdminGuide() {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  if (currentUser?.role === 'admin') {
    return (
      <EmptyState
        illustration="empty-cycle"
        title="관리자 계정에는 자기평가 대상이 없어요"
        description={
          <>
            관리자는 리뷰 운영자로서 사이클을 관리합니다.
            <br />
            사이클 목록에서 진행 중인 리뷰를 확인해 주세요.
          </>
        }
        action={{ label: '사이클 목록으로', onClick: () => navigate('/cycles') }}
      />
    );
  }
  return <MyReviewList />;
}

export default function App() {
  return (
    <ErrorBoundary scope="root">
      <BrowserRouter>
        <OrgSyncProvider />
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <RouteBoundary><Login /></RouteBoundary>
              </RedirectIfAuthed>
            }
          />

          <Route
            element={
              <RequireAuth>
                <ReviewSyncProvider />
                <SyncQueueBootRetry />
                <SchedulerTick />
                <GlobalSearch />
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<RouteBoundary><Dashboard /></RouteBoundary>} />

            {/* Self reviews (leader, member only) */}
            <Route
              path="reviews/me"
              element={
                <RequireRole roles={['leader', 'member', 'admin']}>
                  <RouteBoundary><MyReviewsOrAdminGuide /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="reviews/me/:submissionId"
              element={
                <RequireRole roles={['leader', 'member', 'admin']}>
                  <RouteBoundary><MyReviewWrite /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="reviews/me/peers/:cycleId"
              element={
                <RequireRole roles={['leader', 'member', 'admin']}>
                  <RouteBoundary><PeerPickPage /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="reviews/received"
              element={
                <RequireRole roles={['leader', 'member', 'admin']}>
                  <RouteBoundary><ReceivedReviewList /></RouteBoundary>
                </RequireRole>
              }
            />

            {/* Team reviews (leader only) */}
            <Route
              path="reviews/team"
              element={
                <RequireRole roles={['leader']}>
                  <RouteBoundary><TeamReviewList /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="reviews/team/:cycleId/:userId"
              element={
                <RequireRole roles={['leader', 'admin']}>
                  <RouteBoundary><TeamReviewWrite /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="reviews/team/peer-approvals"
              element={
                <RequireRole roles={['leader', 'admin']}>
                  <RouteBoundary><PeerApprovalPage /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="reviews/proxy/:submissionId"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><ProxyWriteRouter /></RouteBoundary>
                </RequireRole>
              }
            />

            {/* Cycles (admin+) */}
            <Route
              path="cycles"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><CycleList /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="cycles/archive"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><CycleArchive /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="cycles/new"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><CycleNew /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="cycles/:cycleId"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><CycleDetail /></RouteBoundary>
                </RequireRole>
              }
            />

            {/* Templates (admin+) */}
            <Route
              path="templates"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><TemplateList /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="templates/:templateId"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><TemplateBuilder /></RouteBoundary>
                </RequireRole>
              }
            />

            {/* Other pages */}
            <Route path="team" element={<RouteBoundary><Team /></RouteBoundary>} />
            <Route path="settings" element={<RouteBoundary><Settings /></RouteBoundary>} />
            <Route
              path="permissions"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><Permissions /></RouteBoundary>
                </RequireRole>
              }
            />
            <Route
              path="security/audit"
              element={
                <RequireRole roles={['admin']}>
                  <RouteBoundary><AuditLog /></RouteBoundary>
                </RequireRole>
              }
            />

            {/* Catch-all inside authed layout */}
            <Route path="*" element={<RouteBoundary><NotFound /></RouteBoundary>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
