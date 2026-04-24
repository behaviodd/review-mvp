/**
 * 경로 A (raw upsert) 실패 큐 재처리 & 사이클 전체 재푸시
 */
import { useSheetsSyncStore, type PendingSyncOp } from '../stores/sheetsSyncStore';
import { useReviewStore } from '../stores/reviewStore';
import {
  cycleToRow,
  submissionToRow,
  templateToRow,
  retryRawPost,
  opId,
} from './reviewSheetWriter';

interface RetryResult {
  total: number;
  success: number;
  failed: number;
  errors: { id: string; error: string }[];
}

export async function retryOp(op: PendingSyncOp): Promise<boolean> {
  const store = useSheetsSyncStore.getState();
  try {
    await retryRawPost(op.action, op.payload);
    store.markOpSuccess(op.id);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    store.markOpFailure(op.id, msg);
    return false;
  }
}

export async function retryAll(): Promise<RetryResult> {
  const ops = [...useSheetsSyncStore.getState().pendingOps];
  const errors: { id: string; error: string }[] = [];
  let success = 0;
  for (const op of ops) {
    const ok = await retryOp(op);
    if (ok) success += 1;
    else {
      const latest = useSheetsSyncStore.getState().pendingOps.find(p => p.id === op.id);
      errors.push({ id: op.id, error: latest?.lastError ?? 'unknown' });
    }
  }
  return {
    total: ops.length,
    success,
    failed: ops.length - success,
    errors,
  };
}

/**
 * 사이클 단위 재푸시 — cycle + 사용 중인 template + 모든 submissions를 큐에 업서트.
 * 실제 전송은 큐가 처리하며, 이 함수는 enqueue + 즉시 retryAll을 트리거한다.
 */
export async function repushCycle(cycleId: string): Promise<RetryResult> {
  const review = useReviewStore.getState();
  const queue = useSheetsSyncStore.getState();
  const cycle = review.cycles.find(c => c.id === cycleId);
  if (!cycle) {
    return { total: 0, success: 0, failed: 0, errors: [{ id: cycleId, error: '사이클을 찾을 수 없습니다.' }] };
  }
  const template = review.templates.find(t => t.id === cycle.templateId);
  const subs = review.submissions.filter(s => s.cycleId === cycleId);

  queue.enqueueOp({
    id: opId('cycle.upsert', cycle.id),
    kind: 'cycle.upsert',
    action: 'upsertCycle',
    targetId: cycle.id,
    payload: cycleToRow(cycle),
  });
  if (template) {
    queue.enqueueOp({
      id: opId('template.upsert', template.id),
      kind: 'template.upsert',
      action: 'upsertTemplate',
      targetId: template.id,
      payload: templateToRow(template),
    });
  }
  for (const sub of subs) {
    queue.enqueueOp({
      id: opId('submission.upsert', sub.id),
      kind: 'submission.upsert',
      action: 'upsertSubmission',
      targetId: sub.id,
      payload: submissionToRow(sub),
    });
  }
  return retryAll();
}

/**
 * 선택한 submission들만 재푸시.
 */
export async function repushSubmissions(submissionIds: string[]): Promise<RetryResult> {
  const review = useReviewStore.getState();
  const queue = useSheetsSyncStore.getState();
  const subs = review.submissions.filter(s => submissionIds.includes(s.id));
  for (const sub of subs) {
    queue.enqueueOp({
      id: opId('submission.upsert', sub.id),
      kind: 'submission.upsert',
      action: 'upsertSubmission',
      targetId: sub.id,
      payload: submissionToRow(sub),
    });
  }
  return retryAll();
}

/**
 * 큐 상태 요약 (UI 배지용)
 */
export interface SyncSummary {
  pending: number;
  failed: number;      // tryCount > 0
  lastSuccessAt: string | null;
  lastError: string | null;
}

export function getSyncSummary(): SyncSummary {
  const s = useSheetsSyncStore.getState();
  const failed = s.pendingOps.filter(o => o.tryCount > 0).length;
  return {
    pending: s.pendingOps.length,
    failed,
    lastSuccessAt: s.lastSuccessAt,
    lastError: s.reviewSyncError,
  };
}
