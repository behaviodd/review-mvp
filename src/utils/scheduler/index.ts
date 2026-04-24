import type { ReviewCycle, ReviewSubmission } from '../../types';
import { collectPublishJobs, type PublishJob } from './jobs/publishScheduled';
import { collectAutoAdvanceJobs, type AutoAdvanceJob } from './jobs/autoAdvance';
import { collectReminderJobs, type ReminderJob } from './jobs/reminderEngine';
import { collectLifecycleJobs, type LifecycleJob } from './jobs/autoArchive';

export type SchedulerJob = PublishJob | AutoAdvanceJob | ReminderJob | LifecycleJob;

export interface SchedulerSnapshot {
  cycles: ReviewCycle[];
  submissions: ReviewSubmission[];
}

/**
 * 순수 함수: 현 시점 스냅샷을 받아 실행해야 할 Job 목록만 반환.
 * 실제 실행은 SchedulerTick 컴포넌트가 호출.
 */
export function collectJobs(now: Date, snap: SchedulerSnapshot): SchedulerJob[] {
  return [
    ...collectPublishJobs(now, snap.cycles),
    ...collectAutoAdvanceJobs(now, snap.cycles, snap.submissions),
    ...collectReminderJobs(now, snap.cycles, snap.submissions),
    ...collectLifecycleJobs(now, snap.cycles),
  ];
}
