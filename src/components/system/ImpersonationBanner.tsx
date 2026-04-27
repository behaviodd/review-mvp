import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { impersonationLogWriter } from '../../utils/sheetWriter';
import { MsLogoutIcon, MsWarningIcon } from '../ui/MsIcons';

/**
 * R5-b: 마스터 로그인 활성 시 상단 sticky 배너.
 * - "현재 [홍길동]으로 보기 중" 표시
 * - "원래대로" 버튼 — endImpersonation + 시트 로그 마감 + 홈 이동
 */
export function ImpersonationBanner() {
  const currentUser = useAuthStore(s => s.currentUser);
  const impersonatingFromId = useAuthStore(s => s.impersonatingFromId);
  const activeLogId = useAuthStore(s => s.activeImpersonationLogId);
  const endImpersonation = useAuthStore(s => s.endImpersonation);
  const navigate = useNavigate();

  if (!impersonatingFromId || !currentUser) return null;

  const handleEnd = () => {
    if (activeLogId) {
      impersonationLogWriter.end(activeLogId, new Date().toISOString());
    }
    endImpersonation();
    navigate('/');
  };

  return (
    <div className="flex items-center gap-2 bg-red-040 text-white px-4 py-2 text-xs font-semibold">
      <MsWarningIcon size={14} className="shrink-0" />
      <span className="flex-1 truncate">
        마스터 로그인 — 현재 <strong className="font-bold">{currentUser.name}</strong>({currentUser.email})으로 보기 중. 작성·수정·제출은 차단됩니다.
      </span>
      <button
        type="button"
        onClick={handleEnd}
        className="inline-flex items-center gap-1 rounded-md bg-white/20 hover:bg-white/30 px-2 py-0.5 transition-colors"
      >
        <MsLogoutIcon size={12} />
        원래대로
      </button>
    </div>
  );
}
