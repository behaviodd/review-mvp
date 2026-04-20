import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useOrgSync } from './hooks/useOrgSync';
import { useReviewSync } from './hooks/useReviewSync';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MyReviewList } from './pages/reviews/MyReviewList';
import { MyReviewWrite } from './pages/reviews/MyReviewWrite';
import { TeamReviewList } from './pages/reviews/TeamReviewList';
import { TeamReviewWrite } from './pages/reviews/TeamReviewWrite';
import { CycleList } from './pages/reviews/CycleList';
import { CycleNew } from './pages/reviews/CycleNew';
import { CycleDetail } from './pages/reviews/CycleDetail';
import { TemplateList } from './pages/reviews/TemplateList';
import { TemplateBuilder } from './pages/reviews/TemplateBuilder';
import { Team } from './pages/Team';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';

// 로그인 상태일 때만 시트 동기화 실행
function OrgSyncProvider() {
  useOrgSync();
  return null;
}

function ReviewSyncProvider() {
  useReviewSync();
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuthStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { currentUser } = useAuthStore();
  if (!currentUser || !roles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <OrgSyncProvider />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <RequireAuth>
              <ReviewSyncProvider />
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />

          {/* Self reviews */}
          <Route path="reviews/me" element={<MyReviewList />} />
          <Route path="reviews/me/:submissionId" element={<MyReviewWrite />} />

          {/* Team reviews (manager+) */}
          <Route
            path="reviews/team"
            element={
              <RequireRole roles={['admin', 'leader']}>
                <TeamReviewList />
              </RequireRole>
            }
          />
          <Route
            path="reviews/team/:cycleId/:userId"
            element={
              <RequireRole roles={['admin', 'leader']}>
                <TeamReviewWrite />
              </RequireRole>
            }
          />

          {/* Cycles (admin+) */}
          <Route
            path="cycles"
            element={
              <RequireRole roles={['admin']}>
                <CycleList />
              </RequireRole>
            }
          />
          <Route
            path="cycles/new"
            element={
              <RequireRole roles={['admin']}>
                <CycleNew />
              </RequireRole>
            }
          />
          <Route
            path="cycles/:cycleId"
            element={
              <RequireRole roles={['admin']}>
                <CycleDetail />
              </RequireRole>
            }
          />

          {/* Templates (admin+) */}
          <Route
            path="templates"
            element={
              <RequireRole roles={['admin']}>
                <TemplateList />
              </RequireRole>
            }
          />
          <Route
            path="templates/:templateId"
            element={
              <RequireRole roles={['admin']}>
                <TemplateBuilder />
              </RequireRole>
            }
          />

          {/* Other pages */}
          <Route
            path="team"
            element={
              <RequireRole roles={['admin', 'leader']}>
                <Team />
              </RequireRole>
            }
          />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
