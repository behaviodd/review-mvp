import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useAuthStore } from '../../stores/authStore';
import { MsButton } from '../ui/MsButton';
import { Pill } from '../ui/Pill';
import { MsProfileIcon } from '../ui/MsIcons';

/**
 * 피평가자 본인이 동료를 선택(또는 제안)해야 하는 사이클 목록을 상단 알림으로 노출.
 * - reviewee_picks 또는 leader_approves 방식
 * - 이미 최소 인원 이상 선택/제안된 사이클은 제외
 */
export function PeerPickReminder() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const cycles = useReviewStore(s => s.cycles);
  const submissions = useReviewStore(s => s.submissions);

  const pending = useMemo(() => {
    if (!currentUser) return [];
    return cycles.filter(c => {
      if (c.archivedAt || c.status === 'closed' || c.status === 'draft') return false;
      const policy = c.peerSelection;
      if (!policy) return false;
      if (policy.method !== 'reviewee_picks' && policy.method !== 'leader_approves') return false;
      if (!c.reviewKinds?.includes('peer')) return false;
      // 대상자 여부 간단 체크: 이 사이클에 내 self submission이 있는가
      const isTarget = submissions.some(s =>
        s.cycleId === c.id && s.revieweeId === currentUser.id && s.type === 'self'
      );
      if (!isTarget) return false;
      const mineCount = submissions.filter(s =>
        s.cycleId === c.id && s.type === 'peer' && s.revieweeId === currentUser.id
      ).length;
      return mineCount < policy.minPeers;
    });
  }, [cycles, submissions, currentUser]);

  if (pending.length === 0 || !currentUser) return null;

  return (
    <div className="rounded-xl border border-purple-010 bg-purple-005 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-xl bg-purple-010 flex items-center justify-center">
          <MsProfileIcon size={18} className="text-purple-060" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-purple-060">동료 선택이 필요합니다</p>
            <Pill tone="purple" size="sm">{pending.length}개 사이클</Pill>
          </div>
          <p className="mt-0.5 text-xs text-gray-050">
            아래 사이클에서 나를 평가할 동료를 직접 선택해 주세요.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pending.slice(0, 3).map(c => {
              const policy = c.peerSelection!;
              return (
                <MsButton
                  key={c.id}
                  size="sm"
                  variant="brand1"
                  onClick={() => navigate(`/reviews/me/peers/${c.id}`)}
                >
                  {c.title} · {policy.minPeers}–{policy.maxPeers}명
                </MsButton>
              );
            })}
            {pending.length > 3 && (
              <span className="text-[11px] text-gray-050">+ {pending.length - 3}개 더</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
