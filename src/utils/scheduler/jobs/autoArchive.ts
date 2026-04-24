import { useReviewStore } from '../../../stores/reviewStore';
import type { ReviewCycle } from '../../../types';

const ARCHIVE_DAYS = 180;
const EDIT_LOCK_DAYS = 30;

export interface LifecycleJob {
  id: string;
  kind: 'auto_archive' | 'edit_lock';
  cycleId: string;
  run: () => void;
}

/**
 * closedAt이 없는 기존(Phase 3.2b 이전) closed 사이클은 managerReviewDeadline을 대체값으로 사용.
 */
function effectiveClosedAt(c: ReviewCycle): string | undefined {
  if (c.status !== 'closed') return undefined;
  return c.closedAt ?? c.managerReviewDeadline;
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export function collectLifecycleJobs(now: Date, cycles: ReviewCycle[]): LifecycleJob[] {
  const jobs: LifecycleJob[] = [];
  for (const c of cycles) {
    const closedAt = effectiveClosedAt(c);
    if (!closedAt) continue;
    const elapsed = daysSince(closedAt, now);

    if (elapsed >= ARCHIVE_DAYS && !c.archivedAt) {
      jobs.push({
        id: `auto_archive:${c.id}`,
        kind: 'auto_archive',
        cycleId: c.id,
        run: () => {
          const store = useReviewStore.getState();
          const res = store.archiveCycle(c.id, 'system');
          if (res.ok) store.updateCycle(c.id, { autoArchived: true });
        },
      });
      // archive 먼저 처리 — 같은 tick에서 editLock도 중복 걸리지 않도록 아래에서 같이 continue
      continue;
    }
    if (elapsed >= EDIT_LOCK_DAYS && !c.editLockedAt) {
      jobs.push({
        id: `edit_lock:${c.id}`,
        kind: 'edit_lock',
        cycleId: c.id,
        run: () => {
          const store = useReviewStore.getState();
          store.updateCycle(c.id, { editLockedAt: new Date().toISOString() });
        },
      });
    }
  }
  return jobs;
}
