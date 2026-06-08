/**
 * QA 라운드 12 B1 — 목록/상세 status 산정 통일.
 * 기존: 목록은 단순 sub.status 만 표시 → 사이클이 manager_review/closed 단계로 넘어가
 * 상세에서는 readOnly(`cyclePastSelfReview`) 인데 목록은 여전히 '미시작' 으로 보이는 충돌.
 *
 * 이 헬퍼는 (submission, cycle) 쌍에서 표시용 상태를 계산한다.
 * - submitted: 그대로
 * - self 타입이고 cycle.status 가 manager_review/closed: Self 리뷰 기간 종료
 * - 그 외: sub.status (in_progress / not_started)
 *
 * 상세 페이지의 isReadOnly 규칙 (`cyclePastSelfReview`) 과 일치.
 */
import type { ReviewSubmission, ReviewCycle } from '../types';

export type DisplayStatus =
  | 'submitted'
  | 'in_progress'
  | 'not_started'
  | 'past_self_deadline';

export function getDisplayStatus(
  sub: Pick<ReviewSubmission, 'status' | 'type'>,
  cycle: Pick<ReviewCycle, 'status'> | undefined,
): DisplayStatus {
  if (sub.status === 'submitted') return 'submitted';
  if (cycle && sub.type === 'self' && (cycle.status === 'manager_review' || cycle.status === 'closed')) {
    return 'past_self_deadline';
  }
  if (sub.status === 'in_progress') return 'in_progress';
  return 'not_started';
}
