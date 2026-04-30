import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MsButton } from '../ui/MsButton';
import { MsCalendarIcon, MsRefreshIcon, MsEditIcon, MsProfileIcon } from '../ui/MsIcons';
import { ExtendDeadlineModal } from './modals/ExtendDeadlineModal';
import { ReassignReviewerModal } from './modals/ReassignReviewerModal';
import { ProxyWriteConfirmModal } from './modals/ProxyWriteConfirmModal';
import { PeerAssignModal } from './modals/PeerAssignModal';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useShowToast } from '../ui/Toast';
import {
  canExtendDeadline,
  canReassignReviewer,
  canProxyWrite,
  canReopenSubmission,
  hasPermission,
} from '../../utils/permissions';
import type { ReviewCycle, ReviewSubmission, User } from '../../types';

interface Props {
  cycle: ReviewCycle;
  currentUser: User | null;
  selfSub?: ReviewSubmission;
  managerSub?: ReviewSubmission;
  revieweeId?: string;
  revieweeName?: string;
  reviewerName?: string;
}

export function SubmissionActionRail({
  cycle,
  currentUser,
  selfSub,
  managerSub,
  revieweeId,
  revieweeName,
  reviewerName,
}: Props) {
  const navigate = useNavigate();
  const reopen = useReviewStore(s => s.reopenSubmission);
  const assignments = useTeamStore(s => s.reviewerAssignments);
  const groups = useTeamStore(s => s.permissionGroups);
  const showToast = useShowToast();

  const [extendOpen, setExtendOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [proxyConfirm, setProxyConfirm] = useState<null | 'self' | 'manager'>(null);
  const [peerAssignOpen, setPeerAssignOpen] = useState(false);
  const supportsPeer = cycle.reviewKinds?.includes('peer') && cycle.peerSelection?.method === 'admin_assigns';
  const canAssignPeer = !!supportsPeer && !!revieweeId
    && hasPermission(currentUser, 'reviewer_assignments.manage', groups)
    && !cycle.editLockedAt && cycle.status !== 'closed';

  // 권한 계산 (stage별) — R2: assignments + R6: groups 전달로 평가권자/권한그룹 모두 인정
  const canExtendSelf = !!selfSub && canExtendDeadline({ actor: currentUser, cycle, submission: selfSub, assignments, groups });
  const canExtendManager = !!managerSub && canExtendDeadline({ actor: currentUser, cycle, submission: managerSub, assignments, groups });
  const canExtendAny = canExtendSelf || canExtendManager;

  const canReassign = !!managerSub && canReassignReviewer({ actor: currentUser, cycle, submission: managerSub, groups });

  const canProxySelf = !!selfSub && canProxyWrite({ actor: currentUser, cycle, submission: selfSub, groups });

  const canReopenSelf = !!selfSub && canReopenSubmission({ actor: currentUser, cycle, submission: selfSub, assignments, groups });
  const canReopenManager = !!managerSub && canReopenSubmission({ actor: currentUser, cycle, submission: managerSub, assignments, groups });

  if (!currentUser) return null;
  const anyAction =
    canExtendAny || canReassign || canProxySelf || canReopenSelf || canReopenManager || canAssignPeer;
  if (!anyAction) return null;

  const submissionIdsForExtend = [
    ...(canExtendSelf && selfSub ? [selfSub.id] : []),
    ...(canExtendManager && managerSub ? [managerSub.id] : []),
  ];

  const handleReopen = (subId: string) => {
    const res = reopen(subId, currentUser.id);
    showToast(res.ok ? 'success' : 'error', res.ok ? '제출이 재오픈되었습니다.' : (res.error ?? '실패'));
  };

  const handleProxy = () => {
    if (!selfSub) return;
    navigate(`/reviews/proxy/${selfSub.id}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-010 bg-gray-001 px-5 py-2">
        <span className="text-[11px] font-semibold text-fg-subtle">관리자 액션</span>
        {canExtendAny && (
          <MsButton
            variant="outline-default"
            size="sm"
            onClick={() => setExtendOpen(true)}
            leftIcon={<MsCalendarIcon />}
          >
            기한 연장
          </MsButton>
        )}
        {canReassign && (
          <MsButton
            variant="outline-default"
            size="sm"
            onClick={() => setReassignOpen(true)}
            leftIcon={<MsProfileIcon />}
          >
            작성자 변경
          </MsButton>
        )}
        {canProxySelf && (
          <MsButton
            variant="outline-red"
            size="sm"
            onClick={() => setProxyConfirm('self')}
            leftIcon={<MsEditIcon />}
            title="자기평가를 대신 작성합니다"
          >
            대리 작성
          </MsButton>
        )}
        {canReopenSelf && selfSub && (
          <MsButton
            variant="ghost"
            size="sm"
            onClick={() => handleReopen(selfSub.id)}
            leftIcon={<MsRefreshIcon />}
          >
            자기평가 재오픈
          </MsButton>
        )}
        {canReopenManager && managerSub && (
          <MsButton
            variant="ghost"
            size="sm"
            onClick={() => handleReopen(managerSub.id)}
            leftIcon={<MsRefreshIcon />}
          >
            조직장 재오픈
          </MsButton>
        )}
        {canAssignPeer && (
          <MsButton
            variant="outline-default"
            size="sm"
            onClick={() => setPeerAssignOpen(true)}
            leftIcon={<MsProfileIcon />}
          >
            동료 배정
          </MsButton>
        )}
      </div>

      <ExtendDeadlineModal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        cycleId={cycle.id}
        submissionIds={submissionIdsForExtend}
        actorId={currentUser.id}
      />
      <ReassignReviewerModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        submissionId={managerSub?.id ?? null}
        actorId={currentUser.id}
      />
      {proxyConfirm && (
        <ProxyWriteConfirmModal
          open
          onClose={() => setProxyConfirm(null)}
          onConfirm={() => { setProxyConfirm(null); handleProxy(); }}
          stage={proxyConfirm === 'self' ? 'self' : 'downward'}
          revieweeName={revieweeName}
          reviewerName={reviewerName}
        />
      )}
      {revieweeId && supportsPeer && (
        <PeerAssignModal
          open={peerAssignOpen}
          onClose={() => setPeerAssignOpen(false)}
          cycle={cycle}
          revieweeId={revieweeId}
          actorId={currentUser.id}
        />
      )}
    </>
  );
}
