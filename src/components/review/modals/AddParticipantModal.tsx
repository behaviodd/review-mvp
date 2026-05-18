import { useMemo, useState } from 'react';
import { useReviewStore } from '../../../stores/reviewStore';
import { useTeamStore } from '../../../stores/teamStore';
import { useAuthStore } from '../../../stores/authStore';
import { useShowToast } from '../../ui/Toast';
import { MsButton } from '../../ui/MsButton';
import { MsInput } from '../../ui/MsControl';
import { ModalShell } from './ModalShell';
import { UserAvatar } from '../../ui/UserAvatar';

interface Props {
  cycleId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * 진행 중 사이클에 신규 참가자(피평가자) 추가 모달.
 * - 중도 입사·신규 합류 인원 대응
 * - 미참가 + isActive !== false 인 사용자만 후보로 표시 (최대 50명)
 * - 확정 시 addCycleParticipant action 호출 → 즉시 submission 생성
 */
export function AddParticipantModal({ cycleId, open, onClose }: Props) {
  const cycle = useReviewStore(s => s.cycles.find(c => c.id === cycleId));
  const submissions = useReviewStore(s => s.submissions);
  const addCycleParticipant = useReviewStore(s => s.addCycleParticipant);
  const users = useTeamStore(s => s.users);
  const currentUser = useAuthStore(s => s.currentUser);
  const showToast = useShowToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // "참가 중" 판정 = 해당 cycle 에 user 가 reviewee 인 active submission 존재
  // reviewStore.addCycleParticipant 의 게이트 정책과 동일하게 맞춰 후보가
  // 보였는데 추가 시 거부되는 UX 불일치 차단
  const currentMemberIds = useMemo(() => {
    if (!cycle) return new Set<string>();
    const ids = new Set<string>();
    for (const s of submissions) {
      if (s.cycleId !== cycle.id) continue;
      if (s.autoExcluded) continue;
      ids.add(s.revieweeId);
    }
    return ids;
  }, [cycle, submissions]);

  const candidates = useMemo(() => {
    return users
      .filter(u => u.isActive !== false && !currentMemberIds.has(u.id))
      .filter(u => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q) ||
          u.id?.toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [users, currentMemberIds, searchTerm]);

  const handleClose = () => {
    setSearchTerm('');
    setPendingUserId(null);
    onClose();
  };

  const handleConfirm = () => {
    if (!pendingUserId || !currentUser) return;
    setSubmitting(true);
    const res = addCycleParticipant(cycleId, pendingUserId, currentUser.id);
    setSubmitting(false);
    if (res.ok) {
      const u = users.find(x => x.id === pendingUserId);
      showToast('success', `${u?.name ?? '사용자'}님을 추가했습니다. (${res.createdSubmissions ?? 0}건 submission 생성)`);
      handleClose();
    } else {
      showToast('error', res.error ?? '추가에 실패했습니다.');
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="참가자 추가"
      description="중도 입사·신규 합류 인원을 진행 중인 사이클에 추가합니다."
      widthClass="max-w-xl"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
            취소
          </MsButton>
          <MsButton
            variant="brand1"
            size="sm"
            onClick={handleConfirm}
            disabled={!pendingUserId || submitting}
          >
            {submitting ? '추가 중…' : '추가'}
          </MsButton>
        </>
      }
    >
      <div className="space-y-3">
        <MsInput
          placeholder="이름·이메일·부서·사번 검색"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          autoFocus
        />
        <div className="max-h-80 overflow-y-auto border border-gray-010 rounded-lg divide-y divide-gray-010">
          {candidates.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-fg-subtlest">
              추가 가능한 사용자가 없습니다.
            </div>
          ) : (
            candidates.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => setPendingUserId(u.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-005 transition-colors text-left ${
                  pendingUserId === u.id ? 'bg-pink-005' : ''
                }`}
              >
                <UserAvatar user={u} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg-default truncate">{u.name}</p>
                  <p className="text-xs text-fg-subtle truncate">
                    {[u.department, u.position, u.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {pendingUserId === u.id && (
                  <span className="text-xs font-semibold text-pink-060 flex-shrink-0">선택됨</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </ModalShell>
  );
}
