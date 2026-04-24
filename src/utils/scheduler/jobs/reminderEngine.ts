import { useReviewStore } from '../../../stores/reviewStore';
import type {
  ReminderAudience,
  ReminderRule,
  ReviewCycle,
  ReviewSubmission,
  SubmissionStatus,
} from '../../../types';

export interface ReminderJob {
  id: string;
  kind: 'reminder';
  cycleId: string;
  ruleId: string;
  submissionIds: string[];
  run: () => void;
}

const ACTIVE_STATUSES: ReviewCycle['status'][] = ['self_review', 'manager_review', 'calibration', 'active'];
const WINDOW_MS = 24 * 60 * 60 * 1000;  // 도래 후 24시간 내에만 실행

function deadlineForStage(cycle: ReviewCycle, stage: ReminderRule['stage']): string[] {
  const self = cycle.selfReviewDeadline;
  const mgr = cycle.managerReviewDeadline;
  if (stage === 'self') return [self];
  if (stage === 'manager') return [mgr];
  return [self, mgr];
}

function ruleFireTime(deadlineISO: string, rule: ReminderRule): number {
  const dl = new Date(deadlineISO).getTime();
  if (rule.trigger === 'before_deadline') return dl - rule.offsetHours * 60 * 60 * 1000;
  return dl + rule.offsetHours * 60 * 60 * 1000;  // overdue
}

function audienceMatches(status: SubmissionStatus, audience: ReminderAudience): boolean {
  if (audience === 'all_pending') return status !== 'submitted';
  if (audience === 'not_started') return status === 'not_started';
  if (audience === 'in_progress') return status === 'in_progress';
  return false;
}

function submissionsForStage(
  cycle: ReviewCycle,
  submissions: ReviewSubmission[],
  stage: ReminderRule['stage'],
): ReviewSubmission[] {
  return submissions.filter(s => {
    if (s.cycleId !== cycle.id) return false;
    if (stage === 'self') return s.type === 'self';
    if (stage === 'manager') return s.type === 'downward';
    return true;
  });
}

export function collectReminderJobs(
  now: Date,
  cycles: ReviewCycle[],
  submissions: ReviewSubmission[],
): ReminderJob[] {
  const jobs: ReminderJob[] = [];
  const nowMs = now.getTime();
  for (const cycle of cycles) {
    if (!ACTIVE_STATUSES.includes(cycle.status)) continue;
    const rules = cycle.reminderPolicy ?? [];
    for (const rule of rules) {
      const deadlines = deadlineForStage(cycle, rule.stage);
      let fireMs = Number.POSITIVE_INFINITY;
      for (const d of deadlines) {
        const t = ruleFireTime(d, rule);
        if (t <= nowMs && t > fireMs - WINDOW_MS ? false : true) {
          // pick the latest fire time that is <= now
          if (t <= nowMs && nowMs - t <= WINDOW_MS && t < fireMs) fireMs = t;
        }
      }
      if (fireMs === Number.POSITIVE_INFINITY) continue;

      const candidates = submissionsForStage(cycle, submissions, rule.stage)
        .filter(s => audienceMatches(s.status, rule.audience))
        .filter(s => !s.remindersSent?.some(r => r.ruleId === rule.id));

      if (candidates.length === 0) continue;

      const submissionIds = candidates.map(s => s.id);
      jobs.push({
        id: `reminder:${cycle.id}:${rule.id}`,
        kind: 'reminder',
        cycleId: cycle.id,
        ruleId: rule.id,
        submissionIds,
        run: () => {
          const store = useReviewStore.getState();
          store.bulkRemind(submissionIds, 'system', rule.id);
        },
      });
    }
  }
  return jobs;
}
