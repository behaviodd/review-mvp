import { useEffect } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useAuthStore } from '../../stores/authStore';
import { recordAudit } from '../../utils/auditLog';
import { EmptyState } from '../../components/ui/EmptyState';

/**
 * 관리자 대리 작성 진입점.
 *
 * Phase 2: 자기평가(self) 대리 작성만 지원 → MyReviewWrite?proxy=1 로 리다이렉트.
 * 하향 리뷰(downward) 대리 작성은 Phase 2.1로 연기. 대신 "작성자 변경"을 안내한다.
 * 확장 포인트: submission.type별 라우팅 분기를 아래 switch에 추가.
 */
export function ProxyWriteRouter() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const submission = useReviewStore(s => s.submissions.find(x => x.id === submissionId));
  const currentUser = useAuthStore(s => s.currentUser);

  useEffect(() => {
    if (submission && currentUser && submission.type === 'self') {
      recordAudit({
        cycleId: submission.cycleId,
        actorId: currentUser.id,
        action: 'submission.proxy_write_started',
        targetIds: [submission.id],
        summary: `대리 작성 진입 (자기평가)`,
        meta: { revieweeId: submission.revieweeId, reviewerId: submission.reviewerId },
      });
    }
  }, [submission, currentUser]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!submission) {
    return (
      <EmptyState
        illustration="empty-inbox"
        title="제출물을 찾을 수 없어요"
        description={<>삭제되었거나 변경되었을 수 있습니다.<br />사이클 상세에서 다시 진입해 주세요.</>}
        action={{ label: '사이클 목록으로', onClick: () => navigate('/cycles') }}
      />
    );
  }
  if (submission.type === 'self') {
    return <Navigate to={`/reviews/me/${submission.id}?proxy=1`} replace />;
  }
  // downward — Phase 2에서는 지원하지 않음 (확장 지점)
  return (
    <EmptyState
      illustration="empty-list"
      title="조직장 리뷰 대리 작성은 아직 지원되지 않아요"
      description={
        <>
          현재는 자기평가(self) 대리 작성만 지원합니다.
          <br />
          작성자를 다른 조직장으로 변경하면 해당 분이 직접 작성할 수 있습니다.
        </>
      }
      action={{ label: '사이클 상세로 돌아가기', onClick: () => navigate(`/cycles/${submission.cycleId}`) }}
    />
  );
}
