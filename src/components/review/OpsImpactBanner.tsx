import { useMemo } from 'react';
import { MsWarningIcon } from '../ui/MsIcons';
import { MsButton } from '../ui/MsButton';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useShowToast } from '../ui/Toast';
import { recordAudit } from '../../utils/auditLog';
import type { ReviewCycle } from '../../types';

interface Props {
  cycle: ReviewCycle;
  onOpenReassign?: (submissionId: string) => void;
}

export function OpsImpactBanner({ cycle, onOpenReassign }: Props) {
  const submissions = useReviewStore(s => s.submissions);
  const upsertSubmission = useReviewStore(s => s.upsertSubmission);
  const users = useTeamStore(s => s.users);
  const currentUser = useAuthStore(s => s.currentUser);
  const showToast = useShowToast();

  const impacted = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const cycleSubs = submissions.filter(s => s.cycleId === cycle.id && !s.autoExcluded);
    const rows: { submission: typeof cycleSubs[0]; affectedUserId: string; reason: 'inactive' | 'leave_date'; kind: 'reviewer' | 'reviewee' }[] = [];
    for (const sub of cycleSubs) {
      for (const kind of ['reviewer', 'reviewee'] as const) {
        const uid = kind === 'reviewer' ? sub.reviewerId : sub.revieweeId;
        const u = users.find(x => x.id === uid);
        if (!u) continue;
        let reason: 'inactive' | 'leave_date' | undefined;
        if (u.isActive === false) reason = 'inactive';
        else if (u.leaveDate && u.leaveDate <= today) reason = 'leave_date';
        if (reason) {
          rows.push({ submission: sub, affectedUserId: uid, reason, kind });
          break; // 같은 submission 한 번만
        }
      }
    }
    return rows;
  }, [submissions, users, cycle.id]);

  if (impacted.length === 0) return null;
  if (!currentUser || currentUser.role !== 'admin') return null;

  const handleIgnore = (submissionId: string, reason: 'inactive' | 'leave_date') => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return;
    upsertSubmission({
      ...sub,
      autoExcluded: { at: new Date().toISOString(), reason: reason === 'leave_date' ? 'leave_date' : 'inactive' },
    });
    recordAudit({
      cycleId: cycle.id,
      actorId: currentUser.id,
      action: 'cycle.status_transition',
      targetIds: [submissionId],
      summary: `영향 배너 · 무시 처리`,
      meta: { reason },
    });
    showToast('info', '이 항목은 영향 배너에서 더 이상 표시되지 않습니다.');
  };

  const handleDelete = (submissionId: string) => {
    const store = useReviewStore.getState();
    // delete submission via existing path
    const sub = store.submissions.find(s => s.id === submissionId);
    if (!sub) return;
    // reviewStore에 deleteSubmission 전용 액션이 없으므로 submission 전체를 autoExcluded 처리 + 삭제 큐
    // → MVP: autoExcluded로 마킹하여 OpsCenter 리스트에서 보이지 않게 함 (실삭제는 관리자 추가 판단)
    handleIgnore(submissionId, 'inactive');
    showToast('success', '제출을 숨겼습니다. 완전 삭제는 DB 쪽에서 수행하세요.');
  };

  return (
    /* Phase D-3.D-4: 자체 mb-4 — OpsCenter 의 space-y 제거 후 강조 배너만 spacing 유지 */
    <div className="flex flex-col gap-2 rounded-xl border border-red-020 bg-red-005 px-4 py-3 mb-4">
      <div className="flex items-start gap-2">
        <MsWarningIcon size={16} className="mt-0.5 shrink-0 text-red-050" />
        <div className="text-xs text-red-070">
          <p className="font-semibold">
            비활성/퇴사 대상 {impacted.length}건이 이 사이클에 포함되어 있습니다.
          </p>
          <p className="mt-0.5">각 항목에 대해 처리 방법을 선택하세요.</p>
        </div>
      </div>
      <ul className="divide-y divide-red-020/40">
        {impacted.slice(0, 8).map(row => {
          const user = users.find(u => u.id === row.affectedUserId);
          const kindLabel = row.kind === 'reviewer' ? '작성자' : '대상자';
          const reasonLabel = row.reason === 'leave_date' ? '퇴사 예정' : '비활성';
          return (
            <li key={row.submission.id} className="flex items-center gap-2 py-2">
              <span className="flex-1 text-xs text-red-070">
                <strong>{user?.name ?? row.affectedUserId}</strong>
                <span className="text-red-060 font-normal"> ({kindLabel}) · {reasonLabel}</span>
              </span>
              <div className="flex items-center gap-1">
                {row.kind === 'reviewer' && onOpenReassign && row.submission.type === 'downward' && (
                  <MsButton size="sm" variant="outline-default" onClick={() => onOpenReassign(row.submission.id)}>
                    작성자 변경
                  </MsButton>
                )}
                <MsButton size="sm" variant="outline-red" onClick={() => handleDelete(row.submission.id)}>
                  제출 숨김
                </MsButton>
                <MsButton size="sm" variant="ghost" onClick={() => handleIgnore(row.submission.id, row.reason)}>
                  무시
                </MsButton>
              </div>
            </li>
          );
        })}
        {impacted.length > 8 && (
          <li className="py-2 text-[11px] text-red-060">+ {impacted.length - 8}건 더 있음</li>
        )}
      </ul>
    </div>
  );
}
