import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useTeamStore } from './stores/teamStore';
import { hasPermission } from './utils/permissions';
import type { PermissionCode } from './types';
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
import { CycleEdit } from './pages/reviews/CycleEdit';
import { CycleArchive } from './pages/reviews/CycleArchive';
import { TemplateList } from './pages/reviews/TemplateList';
import { TemplateBuilder } from './pages/reviews/TemplateBuilder';
import { Team } from './pages/Team';
import { Settings } from './pages/Settings';
import { Permissions } from './pages/Permissions';
import { ProfileFieldSettings } from './pages/ProfileFieldSettings';
import { PendingApprovals } from './pages/team/PendingApprovals';
import { BulkMove } from './pages/team/BulkMove';
import { AuditLog } from './pages/AuditLog';
import { PendingApproval } from './pages/PendingApproval';

// 로그인 상태일 때만 시트 동기화 실행
function OrgSyncProvider() {
  useOrgSync();
  return null;
}

/**
 * /team/:id 또는 /team/:id/edit 으로 진입하면 /team?member=:id&action=... 으로 리다이렉트.
 * 기존 deep-link / 외부 링크 호환을 유지하면서 dialog/drawer UX 로 통일한다.
 */
function RedirectToTeamMember({ action }: { action?: 'edit' }) {
  const { id } = useParams<{ id: string }>();
  const params = new URLSearchParams();
  if (id) params.set('member', id);
  if (action) params.set('action', action);
  return <Navigate to={`/team?${params.toString()}`} replace />;
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
  // R7: 승인 대기 사용자는 /pending-approval 외 모든 라우트 차단
  if (currentUser.status === 'pending') return <Navigate to="/pending-approval" replace />;
  return <>{children}</>;
}

/** /pending-approval 전용 가드 — 인증된 pending 사용자만 통과. */
function RequirePending({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuthStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.status !== 'pending') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuthStore();
  if (currentUser) {
    // pending 이면 /pending-approval 로, active 면 /
    if (currentUser.status === 'pending') return <Navigate to="/pending-approval" replace />;
    return <Navigate to="/" replace />;
  }
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

/**
 * R6 Bugfix: 권한 코드 기반 라우트 가드.
 * `permissions` 중 하나라도 보유하면 통과 (OR 합집합).
 * admin role 은 자동으로 모든 권한 보유 (hasPermission 내부에서 처리).
 */
function RequirePermission({
  permissions,
  children,
}: {
  permissions: PermissionCode[];
  children: React.ReactNode;
}) {
  const { currentUser } = useAuthStore();
  const impersonatingFromId = useAuthStore(s => s.impersonatingFromId);
  const groups = useTeamStore(s => s.permissionGroups);
  // 마스터 로그인 활성 중에는 admin/권한 라우트 접근 차단 (대상자 화면에 가깝게)
  if (impersonatingFromId) {
    return <Navigate to="/" replace />;
  }
  const ok = !!currentUser && permissions.some(p => hasPermission(currentUser, p, groups));
  if (!ok) {
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

          {/* R7: 승인 대기 — AppLayout 적용 안 함 (사이드바/헤더 없는 빈 페이지) */}
          <Route
            path="/pending-approval"
            element={
              <RequirePending>
                <RouteBoundary><PendingApproval /></RouteBoundary>
              </RequirePending>
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

            {/* Cycles — cycles.manage 권한 보유자 */}
            <Route
              path="cycles"
              element={
                <RequirePermission permissions={['cycles.manage']}>
                  <RouteBoundary><CycleList /></RouteBoundary>
                </RequirePermission>
              }
            />
            <Route
              path="cycles/archive"
              element={
                <RequirePermission permissions={['cycles.manage']}>
                  <RouteBoundary><CycleArchive /></RouteBoundary>
                </RequirePermission>
              }
            />
            <Route
              path="cycles/new"
              element={
                <RequirePermission permissions={['cycles.manage']}>
                  <RouteBoundary><CycleNew /></RouteBoundary>
                </RequirePermission>
              }
            />
            <Route
              path="cycles/:cycleId"
              element={
                <RequirePermission permissions={['cycles.manage']}>
                  <RouteBoundary><CycleDetail /></RouteBoundary>
                </RequirePermission>
              }
            />
            <Route
              path="cycles/:cycleId/edit"
              element={
                <RequirePermission permissions={['cycles.manage']}>
                  <RouteBoundary><CycleEdit /></RouteBoundary>
                </RequirePermission>
              }
            />

            {/* Templates — templates.manage 권한 보유자 */}
            <Route
              path="templates"
              element={
                <RequirePermission permissions={['templates.manage']}>
                  <RouteBoundary><TemplateList /></RouteBoundary>
                </RequirePermission>
              }
            />
            <Route
              path="templates/:templateId"
              element={
                <RequirePermission permissions={['templates.manage']}>
                  <RouteBoundary><TemplateBuilder /></RouteBoundary>
                </RequirePermission>
              }
            />

            {/* Other pages */}
            <Route path="team" element={<RouteBoundary><Team /></RouteBoundary>} />
            <Route
              path="team/profile-fields"
              element={
                <RequirePermission permissions={['org.manage']}>
                  <RouteBoundary><ProfileFieldSettings /></RouteBoundary>
                </RequirePermission>
              }
            />
            {/* 구성원 추가/조회/수정은 Team 페이지의 dialog/drawer 로 일원화.
                기존 deep-link 들은 query 파라미터로 변환해 Team 으로 리다이렉트. */}
            <Route path="team/new" element={<Navigate to="/team?action=add" replace />} />
            <Route path="team/:id" element={<RedirectToTeamMember />} />
            <Route path="team/:id/edit" element={<RedirectToTeamMember action="edit" />} />
            <Route
              path="team/pending-approvals"
              element={
                <RequirePermission permissions={['org.manage']}>
                  <RouteBoundary><PendingApprovals /></RouteBoundary>
                </RequirePermission>
              }
            />
            <Route
              path="team/bulk-move"
              element={
                <RequirePermission permissions={['org.manage']}>
                  <RouteBoundary><BulkMove /></RouteBoundary>
                </RequirePermission>
              }
            />
            <Route path="settings" element={<RouteBoundary><Settings /></RouteBoundary>} />
            <Route
              path="permissions"
              element={
                <RequirePermission permissions={['permission_groups.manage']}>
                  <RouteBoundary><Permissions /></RouteBoundary>
                </RequirePermission>
              }
            />
            <Route
              path="security/audit"
              element={
                <RequirePermission permissions={['audit.view']}>
                  <RouteBoundary><AuditLog /></RouteBoundary>
                </RequirePermission>
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
