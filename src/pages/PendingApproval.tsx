import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { MsButton } from '../components/ui/MsButton';
import { Loader2, ShieldCheck } from 'lucide-react';

/**
 * 신규 회원 승인 대기 화면.
 *
 * 라이프사이클:
 *   - 시트 미등록 사용자가 Google 로그인하면 status='pending' 으로 진입
 *   - 관리자가 `/team` "승인 대기" 탭에서 승인하면 시트에 정식 row 가 생기고,
 *     사용자는 다음 로그인 시 정상 진입
 *   - 사용자는 이 화면에서 [재시도] 로 즉시 확인하거나 로그아웃
 *
 * 승인 후 자동 감지(폴링)는 Phase 2.5 추후 작업.
 */
export function PendingApproval() {
  const { currentUser, logout } = useAuthStore();
  const navigate = useNavigate();

  // pending 이 아닌데 이 페이지로 들어왔으면 정리
  useEffect(() => {
    if (!currentUser) { navigate('/login', { replace: true }); return; }
    if (currentUser.status !== 'pending') { navigate('/', { replace: true }); }
  }, [currentUser, navigate]);

  if (!currentUser || currentUser.status !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center text-fg-subtlest text-base">
        <Loader2 className="size-4 mr-2 animate-spin" />
        이동 중...
      </div>
    );
  }

  const handleRetry = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-010 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl ring-1 ring-gray-010 shadow-sm p-6 space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-full bg-yellow-005 mb-3">
            <ShieldCheck className="size-6 text-yellow-060" />
          </div>
          <h1 className="text-xl font-semibold text-fg-default">관리자 승인 대기 중</h1>
          <p className="text-base text-fg-subtle mt-1.5 leading-relaxed">
            관리자가 계정을 승인하면 모든 기능을 사용할 수 있습니다.
            <br />
            승인은 영업일 기준 1일 이내에 완료됩니다.
          </p>
        </div>

        <div className="bg-gray-005 rounded-xl p-4 space-y-1.5 text-base">
          <Row label="이름" value={currentUser.name} />
          <Row label="이메일" value={currentUser.email} />
        </div>

        <div className="space-y-2">
          <MsButton variant="brand1" className="w-full" onClick={handleRetry}>
            승인 확인을 위해 다시 로그인
          </MsButton>
          <MsButton variant="ghost" className="w-full" onClick={() => { logout(); navigate('/login', { replace: true }); }}>
            로그아웃
          </MsButton>
        </div>

        <p className="text-center text-xs text-fg-subtlest">
          문의: 시스템 관리자에게 연락해 주세요.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-fg-subtle">{label}</span>
      <span className="text-base text-fg-default font-medium truncate">{value}</span>
    </div>
  );
}
