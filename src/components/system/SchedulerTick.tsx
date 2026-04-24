import { useEffect, useRef } from 'react';
import { useReviewStore } from '../../stores/reviewStore';
import { useAuthStore } from '../../stores/authStore';
import { collectJobs } from '../../utils/scheduler';
import { acquireLeader } from '../../utils/scheduler/tickLock';

const TICK_MS = 60_000;  // 60초
const BOOT_DELAY_MS = 5_000;  // 부팅 후 5초 뒤 첫 실행

/**
 * admin 로그인 시에만 백그라운드에서 자동화 규칙을 실행.
 * 여러 탭 중 하나만 실제 작업을 수행하도록 localStorage CAS 리더 선거.
 */
export function SchedulerTick() {
  const role = useAuthStore(s => s.currentUser?.role);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        if (!acquireLeader()) return;
        const { cycles, submissions } = useReviewStore.getState();
        const jobs = collectJobs(new Date(), { cycles, submissions });
        for (const job of jobs) {
          try {
            await job.run();
          } catch (e) {
            console.error(`[Scheduler] ${job.id} 실패:`, e);
          }
        }
      } catch (e) {
        console.error('[Scheduler] tick error:', e);
      }
    };

    const boot = window.setTimeout(tick, BOOT_DELAY_MS);
    const interval = window.setInterval(tick, TICK_MS);
    timerRef.current = interval;
    return () => {
      stopped = true;
      window.clearTimeout(boot);
      window.clearInterval(interval);
    };
  }, [role]);

  return null;
}
