/**
 * 관리자 개입 액션에 대한 권한 판단을 한곳에서 관리한다.
 *
 * R2: admin 외에 평가권자(ReviewerAssignment 활성)도 자기 reviewee submission 에
 *     대해 일부 액션 가능. 권한 매트릭스는 docs/permissions.md 참조.
 */
import type { ReviewCycle, ReviewSubmission, ReviewerAssignment, User } from '../types';

export interface PermissionContext {
  actor: User | null;
  cycle?: ReviewCycle;
  submission?: ReviewSubmission;
  /** R2: 평가권 테이블 — admin이 아닌 actor 의 권한 룩업에 사용. */
  assignments?: ReviewerAssignment[];
}

function isAdmin(actor: User | null | undefined): boolean {
  return !!actor && actor.role === 'admin';
}

function isCycleMutable(cycle?: ReviewCycle): boolean {
  if (!cycle) return false;
  if (cycle.status === 'closed') return false;
  if (cycle.editLockedAt) return false;
  return true;
}

/**
 * R2 헬퍼: actor 가 submission 의 reviewee 에 대해 활성 평가권을 가진 평가권자인지.
 * rank 무관 (1차/2차 모두 인정). 자기 reviewee 한정 권한 부여 시 사용.
 */
function isAssignedReviewer(
  actor: User | null | undefined,
  submission: ReviewSubmission | undefined,
  assignments: ReviewerAssignment[] | undefined,
): boolean {
  if (!actor || !submission || !assignments) return false;
  return assignments.some(a =>
    a.reviewerId === actor.id &&
    a.revieweeId === submission.revieweeId &&
    !a.endDate
  );
}

export function canUnlockEdit(actor: User | null | undefined): boolean {
  return isAdmin(actor);
}

/**
 * 마감 연장.
 * - admin: 모든 사이클·submission
 * - 평가권자(자기 reviewee 한정): 활성 평가권을 가진 reviewee 의 submission
 *   (해당 평가권자가 직접 작성하는 submission 의 마감 연장도 포함)
 * - 그 외: 거부 (피평가자 본인이 자기 self 마감을 연장하는 등은 차단)
 */
export function canExtendDeadline(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (isAdmin(ctx.actor)) return true;
  if (ctx.submission && isAssignedReviewer(ctx.actor, ctx.submission, ctx.assignments)) {
    return true;
  }
  return false;
}

/**
 * 평가자 변경 — admin only.
 * 평가권자가 자기 자신을 다른 사람으로 변경하는 것은 정책 충돌이므로 불허.
 */
export function canReassignReviewer(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.type !== 'downward') return false;
  return isAdmin(ctx.actor);
}

/**
 * 대리 작성 — admin only.
 * 평가권자/리더는 자기 권한 범위에서 직접 작성 가능하므로 대리 불필요.
 */
export function canProxyWrite(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.status === 'submitted') return false;
  return isAdmin(ctx.actor);
}

/**
 * 제출 재오픈.
 * - admin: 모든 submission
 * - 평가권자(자기 reviewee 한정): 활성 평가권을 가진 reviewee 의 제출된 submission
 */
export function canReopenSubmission(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.status !== 'submitted') return false;
  if (isAdmin(ctx.actor)) return true;
  if (ctx.submission && isAssignedReviewer(ctx.actor, ctx.submission, ctx.assignments)) {
    return true;
  }
  return false;
}

export function canViewAuditLog(actor: User | null | undefined): boolean {
  return isAdmin(actor);
}

export function canBulkIntervene(ctx: Pick<PermissionContext, 'actor' | 'cycle'>): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  return isAdmin(ctx.actor);
}

/**
 * R2: 결과 열람 (타인 submission).
 * - admin: 모든 submission
 * - 평가권자: 자기 reviewee 의 모든 submission (제출 상태 무관)
 * - 그 외: false (피평가자 본인 열람은 별도 visibility 정책으로 처리)
 */
export function canViewSubmissionResult(ctx: PermissionContext): boolean {
  if (isAdmin(ctx.actor)) return true;
  if (ctx.submission && isAssignedReviewer(ctx.actor, ctx.submission, ctx.assignments)) {
    return true;
  }
  return false;
}

/**
 * R2: 동료 제안 승인/반려.
 * - admin: 모든 제안
 * - 평가권자: 자기 reviewee 의 제안만
 */
export function canDecidePeerProposal(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (isAdmin(ctx.actor)) return true;
  if (ctx.submission && isAssignedReviewer(ctx.actor, ctx.submission, ctx.assignments)) {
    return true;
  }
  return false;
}
