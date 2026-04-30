import { useMemo, useState } from 'react';
import { ModalShell } from './ModalShell';
import { MsButton } from '../../ui/MsButton';
import { MsSelect, MsTextarea } from '../../ui/MsControl';
import { useReviewStore } from '../../../stores/reviewStore';
import { useTeamStore } from '../../../stores/teamStore';
import { useShowToast } from '../../ui/Toast';
import { getSmallestOrg } from '../../../utils/userUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  submissionId: string | null;
  actorId: string;
  onApplied?: () => void;
}

export function ReassignReviewerModal({ open, onClose, submissionId, actorId, onApplied }: Props) {
  const submission = useReviewStore(s =>
    submissionId ? s.submissions.find(x => x.id === submissionId) : undefined
  );
  const cycle = useReviewStore(s =>
    submission ? s.cycles.find(c => c.id === submission.cycleId) : undefined
  );
  const reassignReviewer = useReviewStore(s => s.reassignReviewer);
  const users = useTeamStore(s => s.users);
  const showToast = useShowToast();

  const [toId, setToId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const currentReviewer = submission ? users.find(u => u.id === submission.reviewerId) : undefined;
  const reviewee = submission ? users.find(u => u.id === submission.revieweeId) : undefined;

  const candidates = useMemo(() => {
    if (!submission) return [];
    return users
      .filter(u =>
        u.id !== submission.reviewerId &&
        u.id !== submission.revieweeId &&
        u.isActive !== false
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [users, submission]);

  if (!submission || !cycle) return null;

  const disabled = !toId || loading;

  const handleApply = () => {
    if (disabled) return;
    setLoading(true);
    const res = reassignReviewer(submission.id, toId, actorId, reason.trim() || undefined);
    setLoading(false);
    if (!res.ok) {
      showToast('error', res.error ?? '작성자 변경에 실패했습니다.');
      return;
    }
    const next = users.find(u => u.id === toId);
    showToast('success', `작성자가 ${next?.name ?? toId}(으)로 변경되었습니다.`);
    onApplied?.();
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="작성자 변경"
      description={`"${cycle.title}" · ${reviewee?.name ?? '대상자'} 리뷰`}
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose}>취소</MsButton>
          <MsButton size="sm" onClick={handleApply} disabled={disabled} loading={loading}>
            변경 적용
          </MsButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-010 bg-gray-001 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-fg-subtlest">현재 작성자</span>
            <span className="font-semibold text-gray-080">
              {currentReviewer ? `${currentReviewer.name} · ${getSmallestOrg(currentReviewer)}` : submission.reviewerId}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-060 mb-1">새 작성자</label>
          <MsSelect value={toId} onChange={e => setToId(e.target.value)}>
            <option value="">선택하세요</option>
            {candidates.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.position} · {getSmallestOrg(u)}
              </option>
            ))}
          </MsSelect>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-060 mb-1">사유 (선택)</label>
          <MsTextarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="예) 기존 조직장 부재"
          />
        </div>
      </div>
    </ModalShell>
  );
}
