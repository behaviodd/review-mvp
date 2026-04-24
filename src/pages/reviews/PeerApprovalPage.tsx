import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { MsButton } from '../../components/ui/MsButton';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { Pill } from '../../components/ui/Pill';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useShowToast } from '../../components/ui/Toast';
import { MsCheckIcon, MsCancelIcon, MsProfileIcon } from '../../components/ui/MsIcons';
import { getSmallestOrg } from '../../utils/userUtils';
import { timeAgo } from '../../utils/dateUtils';

export function PeerApprovalPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const submissions = useReviewStore(s => s.submissions);
  const cycles = useReviewStore(s => s.cycles);
  const users = useTeamStore(s => s.users);
  const orgUnits = useTeamStore(s => s.orgUnits);
  const decidePeerProposal = useReviewStore(s => s.decidePeerProposal);
  const showToast = useShowToast();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  useSetPageHeader('동료 리뷰 승인 요청');

  // 현재 사용자가 "리더"인 reviewee 집합: user.managerId === currentUser.id
  // 또는 orgUnit.headId === currentUser.id 인 조직의 구성원
  const leadeeIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    const byManager = users.filter(u => u.managerId === currentUser.id).map(u => u.id);
    const headOrgs = new Set(orgUnits.filter(o => o.headId === currentUser.id).map(o => o.name));
    const byOrg = users.filter(u =>
      headOrgs.has(u.department) || headOrgs.has(u.subOrg ?? '__') ||
      headOrgs.has(u.team ?? '__') || headOrgs.has(u.squad ?? '__')
    ).map(u => u.id);
    return new Set([...byManager, ...byOrg]);
  }, [currentUser, users, orgUnits]);

  // 리더가 결정해야 할 pending peer 제안들
  const pending = useMemo(() => {
    return submissions
      .filter(s => s.type === 'peer' && s.peerProposal?.status === 'pending' && leadeeIds.has(s.revieweeId))
      .sort((a, b) => (a.peerProposal?.proposedAt ?? '').localeCompare(b.peerProposal?.proposedAt ?? ''));
  }, [submissions, leadeeIds]);

  const historyCount = useMemo(() => {
    return submissions.filter(s =>
      s.type === 'peer' &&
      s.peerProposal &&
      s.peerProposal.status !== 'pending' &&
      leadeeIds.has(s.revieweeId)
    ).length;
  }, [submissions, leadeeIds]);

  if (!currentUser) return <div className="text-center py-20 text-gray-040">로그인이 필요합니다.</div>;

  const handleApprove = (submissionId: string) => {
    const res = decidePeerProposal(submissionId, true, currentUser.id);
    showToast(res.ok ? 'success' : 'error', res.ok ? '제안을 승인했습니다.' : (res.error ?? '실패'));
  };
  const handleReject = (submissionId: string, reason?: string) => {
    const res = decidePeerProposal(submissionId, false, currentUser.id, reason);
    showToast(res.ok ? 'success' : 'error', res.ok ? '제안을 반려했습니다.' : (res.error ?? '실패'));
    setRejectTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Pill tone="warning" size="md">승인 대기 {pending.length}</Pill>
        <Pill tone="neutral" size="md">처리 완료 {historyCount}</Pill>
      </div>

      {pending.length === 0 ? (
        <EmptyState
          icon={MsCheckIcon}
          title="승인 대기 중인 제안이 없습니다."
          description="팀원이 동료 평가자를 제안하면 여기에 표시됩니다."
          action={{ label: '내 팀원 보기', onClick: () => navigate('/reviews/team') }}
        />
      ) : (
        <div className="rounded-xl border border-gray-010 bg-white shadow-card divide-y divide-gray-005">
          {pending.map(sub => {
            const reviewee = users.find(u => u.id === sub.revieweeId);
            const proposer = users.find(u => u.id === sub.peerProposal?.proposedBy);
            const reviewer = users.find(u => u.id === sub.reviewerId);
            const cycle = cycles.find(c => c.id === sub.cycleId);
            return (
              <div key={sub.id} className="flex items-center gap-3 px-5 py-3">
                <MsProfileIcon size={20} className="shrink-0 text-gray-040" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-080">
                    <strong>{reviewee?.name ?? '대상자'}</strong>의 동료 리뷰어로
                    {' '}
                    <strong>{reviewer?.name ?? '동료'}</strong> 제안
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-040">
                    {cycle?.title} · 제안자 {proposer?.name ?? '본인'} ·
                    {' '}{sub.peerProposal?.proposedAt ? timeAgo(sub.peerProposal.proposedAt) : '-'}
                  </p>
                </div>
                {reviewer && (
                  <div className="hidden md:flex shrink-0 items-center gap-2">
                    <UserAvatar user={reviewer} size="sm" />
                    <span className="text-xs text-gray-060 truncate">{getSmallestOrg(reviewer)}</span>
                  </div>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <MsButton
                    size="sm"
                    variant="outline-red"
                    leftIcon={<MsCancelIcon />}
                    onClick={() => setRejectTarget(sub.id)}
                  >
                    반려
                  </MsButton>
                  <MsButton
                    size="sm"
                    variant="brand1"
                    leftIcon={<MsCheckIcon />}
                    onClick={() => handleApprove(sub.id)}
                  >
                    승인
                  </MsButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && handleReject(rejectTarget, reason)}
        title="동료 리뷰 제안 반려"
        description="반려 사유를 간단히 남겨 주세요. 사유는 제안자에게 전달되고 감사 로그에 기록됩니다."
        confirmLabel="반려 확정"
        tone="danger"
        requireReason
        reasonPlaceholder="예) 다른 팀과 협업이 적어 평가 적합성 낮음"
      />
    </div>
  );
}
