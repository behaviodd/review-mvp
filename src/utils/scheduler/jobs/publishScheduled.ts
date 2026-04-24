import { useReviewStore } from '../../../stores/reviewStore';
import type { ReviewCycle } from '../../../types';

export interface PublishJob {
  id: string;
  kind: 'publish';
  cycleId: string;
  run: () => void;
}

export function collectPublishJobs(now: Date, cycles: ReviewCycle[]): PublishJob[] {
  const jobs: PublishJob[] = [];
  for (const c of cycles) {
    if (c.status !== 'draft') continue;
    if (!c.scheduledPublishAt) continue;
    if (new Date(c.scheduledPublishAt).getTime() > now.getTime()) continue;
    jobs.push({
      id: `publish:${c.id}`,
      kind: 'publish',
      cycleId: c.id,
      run: () => {
        const store = useReviewStore.getState();
        const res = store.publishCycle(c.id, 'system');
        if (res.ok) {
          // 다음 tick에서 다시 잡히지 않도록 예약값 클리어
          store.updateCycle(c.id, { scheduledPublishAt: undefined });
        }
      },
    });
  }
  return jobs;
}
