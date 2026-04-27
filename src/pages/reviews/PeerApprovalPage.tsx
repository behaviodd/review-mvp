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
import { ListToolbar } from '../../components/ui/ListToolbar';
import { useShowToast } from '../../components/ui/Toast';
import { MsCheckIcon, MsCancelIcon, MsProfileIcon } from '../../components/ui/MsIcons';
import { getSmallestOrg } from '../../utils/userUtils';
import { formatDate, timeAgo } from '../../utils/dateUtils';

type ViewMode = 'pending' | 'history';

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
  const [viewMode, setViewMode] = useState<ViewMode>('pending');

  useSetPageHeader('동료 리뷰 승인 요청');

  // 현재 사용자가 "리더"인 reviewee 집합
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

  // 처리 완료된 제안 (approved + rejected)
  const history = useMemo(() => {
    return submissions
      .filter(s =>
        s.type === 'peer' &&
        s.peerProposal &&
        s.peerProposal.status !== 'pending' &&
        leadeeIds.has(s.revieweeId)
      )
      .sort((a, b) => (b.peerProposal?.decidedAt ?? '').localeCompare(a.peerProposal?.decidedAt ?? ''));
  }, [submissions, leadeeIds]);

  if (!currentUser) {
    return (
      <EmptyState
        illustration="empty-list"
        title="로그인이 필요해요"
        description="로그인 후 다시 시도해 주세요."
        action={{ label: '로그인으로', onClick: () => navigate('/login') }}
      />
    );
  }

  const handleApprove = (submissionId: string) => {
    const res = decidePeerProposal(submissionId, true, currentUser.id);
    showToast(res.ok ? 'success' : 'error', res.ok ? '제안을 승인했습니다.' : (res.error ?? '실패'));
  };
  const handleReject = (submissionId: string, reason?: string) => {
    const res = decidePeerProposal(submissionId, false, currentUser.id, reason);
    showToast(res.ok ? 'success' : 'error', res.ok ? '제안을 반려했습니다.' : (res.error ?? '실패'));
    setRejectTarget(null);
  };

  const rows = viewMode === 'pending' ? pending : history;

  return (
    <div className="space-y-4">
      <ListToolbar
        segments={[
          {
            kind: 'pills',
            key: 'view',
            ariaLabel: '승인 상태 필터',
            value: viewMode,
            onChange: v => setViewMode(v as ViewMode),
            options: [
              { value: 'pending', label: '승인 대기', count: pending.length },
              { value: 'history', label: '처리 완료', count: history.length },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={MsCheckIcon}
          title={viewMode === 'pending' ? '승인 대기 중인 제안이 없어요.' : '처리 완료된 제안이 없어요.'}
          description={
            viewMode === 'pending'
              ? '팀원이 동료 평가자를 제안하면 여기에 표시됩니다.'
              : '승인 또는 반려한 제안이 이곳에 기록됩니다.'
          }
          action={viewMode === 'pending'
            ? { label: '내 팀원 보기', onClick: () => navigate('/reviews/team') }
            : undefined}
        />
      ) : (
        <div className="rounded-xl border border-gray-010 bg-white shadow-card divide-y divide-gray-005">
          {rows.map(sub => {
            const reviewee = users.find(u => u.id === sub.revieweeId);
            const proposer = users.find(u => u.id === sub.peerProposal?.proposedBy);
            const reviewer = users.find(u => u.id === sub.reviewerId);
            const cycle = cycles.find(c => c.id === sub.cycleId);
            const status = sub.peerProposal?.status ?? 'pending';
            const isPending = status === 'pending';

            return (
              <div key={sub.id} className="flex items-center gap-3 px-5 py-3">
                <MsProfileIcon size={20} className="shrink-0 text-gray-040" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-080">
                    <strong>{reviewee?.name ?? '대상자'}</strong>의 동료 리뷰어로{' '}
                    <strong>{reviewer?.name ?? '동료'}</strong> 제안
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-040">
                    {cycle?.title} · 제안자 {proposer?.name ?? '본인'} ·{' '}
                    {isPending
                      ? (sub.peerProposal?.proposedAt ? timeAgo(sub.peerProposal.proposedAt) : '-')
                      : `${status === 'approved' ? '승인' : '반려'} ${sub.peerProposal?.decidedAt ? formatDate(sub.peerProposal.decidedAt) : '-'}`
                    }
                    {status === 'rejected' && sub.peerProposal?.rejectionReason && (
                      <span className="ml-1 text-gray-050">· 사유: {sub.peerProposal.rejectionReason}</span>
                    )}
                  </p>
                </div>

                {reviewer && (
                  <div className="hidden md:flex shrink-0 items-center gap-2">
                    <UserAvatar user={reviewer} size="sm" />
                    <span className="text-xs text-gray-060 truncate">{getSmallestOrg(reviewer)}</span>
                  </div>
                )}

                {isPending ? (
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
                ) : (
                  <Pill
                    tone={status === 'approved' ? 'success' : 'danger'}
                    size="sm"
                    leftIcon={status === 'approved' ? <MsCheckIcon size={10} /> : <MsCancelIcon size={10} />}
                  >
                    {status === 'approved' ? '승인됨' : '반려됨'}
                  </Pill>
                )}
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
