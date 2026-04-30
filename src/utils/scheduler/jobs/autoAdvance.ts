import { useReviewStore } from '../../../stores/reviewStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useTeamStore } from '../../../stores/teamStore';
import { recordAudit } from '../../auditLog';
import { resolveTargetMembers } from '../../resolveTargets';
import type { Notification, ReviewCycle, ReviewSubmission } from '../../../types';

export interface AutoAdvanceJob {
  id: string;
  kind: 'auto_advance';
  cycleId: string;
  run: () => void;
}

function selfSubmissionRate(cycleId: string, submissions: ReviewSubmission[]): number {
  const selfs = submissions.filter(s => s.cycleId === cycleId && s.type === 'self');
  if (selfs.length === 0) return 0;
  const done = selfs.filter(s => s.status === 'submitted').length;
  return Math.round((done / selfs.length) * 100);
}

export function collectAutoAdvanceJobs(
  now: Date,
  cycles: ReviewCycle[],
  submissions: ReviewSubmission[],
): AutoAdvanceJob[] {
  const jobs: AutoAdvanceJob[] = [];
  const nowMs = now.getTime();
  for (const c of cycles) {
    if (c.status !== 'self_review') continue;
    const rule = c.autoAdvance;
    if (!rule || rule.stage !== 'self_to_manager') continue;
    const deadlineMs = new Date(c.selfReviewDeadline).getTime();
    const threshold = nowMs - rule.graceHours * 60 * 60 * 1000;
    if (threshold < deadlineMs) continue;
    const rate = selfSubmissionRate(c.id, submissions);
    if (rule.threshold != null && rate < rule.threshold) continue;

    jobs.push({
      id: `auto_advance:${c.id}`,
      kind: 'auto_advance',
      cycleId: c.id,
      run: () => {
        const store = useReviewStore.getState();
        const users = useTeamStore.getState().users;
        const orgUnits = useTeamStore.getState().orgUnits;
        const current = store.cycles.find(x => x.id === c.id);
        if (!current || current.status !== 'self_review') return;

        store.updateCycle(c.id, { status: 'manager_review' });

        // 조직장 알림 (self_review → manager_review 수동 전환 로직과 동일)
        const { addNotification } = useNotificationStore.getState();
        const targets = resolveTargetMembers(current, users);
        const leaderIds = new Set<string>();
        for (const m of targets) {
          const mgr = users.find(u => u.id === m.managerId);
          if (mgr) { leaderIds.add(mgr.id); continue; }
          const org = orgUnits.find(o =>
            o.headId && o.headId !== m.id &&
            (o.name === m.department || o.name === m.subOrg || o.name === m.team || o.name === m.squad)
          );
          if (org?.headId) leaderIds.add(org.headId);
        }
        const at = new Date().toISOString();
        Array.from(leaderIds).forEach((leaderId, i) => {
          const note: Notification = {
            id: `mgr_auto_${Date.now()}_${i}_${leaderId}`,
            userId: leaderId,
            title: '조직장 리뷰 자동 시작',
            message: `"${current.title}" 리뷰가 자동 규칙에 의해 조직장 리뷰 단계로 전환되었습니다.`,
            type: 'system',
            isRead: false,
            createdAt: at,
            actionUrl: '/reviews/team',
          };
          addNotification(note);
        });

        recordAudit({
          cycleId: c.id,
          actorId: 'system',
          action: 'cycle.status_transition',
          targetIds: [c.id],
          summary: `자동 단계 전환 (자기평가 → 조직장 리뷰) · 제출율 ${rate}%`,
          meta: { trigger: 'auto', from: 'self_review', to: 'manager_review', rate, threshold: rule.threshold },
        });
      },
    });
  }
  return jobs;
}
