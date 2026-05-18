import { useState } from 'react';
import { useReviewStore } from '../../../stores/reviewStore';
import { useTeamStore } from '../../../stores/teamStore';
import { useAuthStore } from '../../../stores/authStore';
import { useShowToast } from '../../ui/Toast';
import { MsButton } from '../../ui/MsButton';
import { MsTextarea } from '../../ui/MsControl';
import { ModalShell } from './ModalShell';
import { UserAvatar } from '../../ui/UserAvatar';

interface Props {
  cycleId: string;
  userId: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 사이클 진행 중 참가자 제외 확정 모달.
 * - 특정 userId 가 미리 결정된 상태에서 사유만 받는 confirm 다이얼로그
 * - removeCycleParticipant action 호출 → 미완료 submission autoExcluded 마크
 *   (제출 완료된 건은 보존)
 */
export function RemoveParticipantModal({ cycleId, userId, open, onClose }: Props) {
  const removeCycleParticipant = useReviewStore(s => s.removeCycleParticipant);
  const users = useTeamStore(s => s.users);
  const currentUser = useAuthStore(s => s.currentUser);
  const showToast = useShowToast();

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetUser = userId ? users.find(u => u.id === userId) : undefined;

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const handleConfirm = () => {
    if (!userId || !currentUser) return;
    setSubmitting(true);
    const res = removeCycleParticipant(cycleId, userId, currentUser.id, reason.trim() || undefined);
    setSubmitting(false);
    if (res.ok) {
      showToast('success', `${targetUser?.name ?? '사용자'}님을 제외했습니다. (${res.markedSubmissions ?? 0}건 자동제외)`);
      handleClose();
    } else {
      showToast('error', res.error ?? '제외에 실패했습니다.');
    }
  };

  if (!targetUser) return null;

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="참가자 제외"
      description="제출 완료된 건은 보존되며, 미완료 submission 만 자동제외 마크됩니다."
      widthClass="max-w-md"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
            취소
          </MsButton>
          <MsButton
            variant="outline-red"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? '제외 중…' : '제외'}
          </MsButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-005 rounded-lg">
          <UserAvatar user={targetUser} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-fg-default truncate">{targetUser.name}</p>
            <p className="text-xs text-fg-subtle truncate">
              {[targetUser.department, targetUser.position, targetUser.email].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-fg-subtle mb-1 block">제외 사유 (선택)</label>
          <MsTextarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="예: 중도 퇴사 / 부서 이동 / 휴직"
            autoFocus
          />
        </div>
      </div>
    </ModalShell>
  );
}
