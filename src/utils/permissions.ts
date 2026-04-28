/**
 * 관리자 개입 액션에 대한 권한 판단을 한곳에서 관리한다.
 *
 * R6: PermissionGroup 기반으로 일원화.
 *   - admin role 사용자는 자동으로 모든 권한 (소유자 그룹)
 *   - 그 외 사용자는 PermissionGroup 멤버십에 따라 권한 누적
 *   - 평가권자(ReviewerAssignment 활성)는 자기 reviewee 한정 일부 액션 가능
 *
 * 권한 매트릭스: docs/permissions.md 참조.
 */
import type {
  ReviewCycle, ReviewSubmission, ReviewerAssignment,
  PermissionCode, PermissionGroup, User,
} from '../types';

export interface PermissionContext {
  actor: User | null;
  cycle?: ReviewCycle;
  submission?: ReviewSubmission;
  /** 평가권 테이블 — 평가권자 권한 룩업에 사용. */
  assignments?: ReviewerAssignment[];
  /** R6: 권한 그룹 — 코드 기반 권한 룩업에 사용. */
  groups?: PermissionGroup[];
}

function isAdmin(actor: User | null | undefined): boolean {
  return !!actor && actor.role === 'admin';
}

/**
 * R7: 시스템 운영자 여부.
 *
 * `User.role === 'admin'` 의 의미를 *권한* 이 아닌 *평가 참여 분류* 로 명확화한 헬퍼.
 * 사이클 자동 제외 / 리뷰어 후보 필터 등 비즈니스 로직에서 사용.
 *
 * 권한 판단(메뉴/액션 가시성)은 `hasPermission(actor, code, groups)` 또는
 * `usePermission()` 을 사용하세요. 이 함수는 권한과 무관합니다.
 */
export function isSystemOperator(user: User | null | undefined): boolean {
  return !!user && user.role === 'admin';
}

/**
 * R6: actor 가 권한 코드를 보유하는지.
 * - admin role: 자동으로 모든 권한
 * - 외: 그룹 멤버십 기반 합집합
 */
export function hasPermission(
  actor: User | null | undefined,
  code: PermissionCode,
  groups?: PermissionGroup[],
): boolean {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  if (!groups) return false;
  return groups.some(g =>
    g.memberIds.includes(actor.id) && g.permissions.includes(code)
  );
}

function isCycleMutable(cycle?: ReviewCycle): boolean {
  if (!cycle) return false;
  if (cycle.status === 'closed') return false;
  if (cycle.editLockedAt) return false;
  return true;
}

/**
 * actor 가 submission 의 reviewee 에 대해 활성 평가권을 가진 평가권자인지.
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

export function canUnlockEdit(actor: User | null | undefined, groups?: PermissionGroup[]): boolean {
  return hasPermission(actor, 'cycles.manage', groups);
}

/**
 * 마감 연장.
 * - cycles.manage 권한자: 모든 사이클·submission
 * - 평가권자(자기 reviewee 한정): 활성 평가권을 가진 reviewee 의 submission
 */
export function canExtendDeadline(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (hasPermission(ctx.actor, 'cycles.manage', ctx.groups)) return true;
  if (ctx.submission && isAssignedReviewer(ctx.actor, ctx.submission, ctx.assignments)) {
    return true;
  }
  return false;
}

/**
 * 평가자 변경 — cycles.manage 또는 reviewer_assignments.manage.
 */
export function canReassignReviewer(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.type !== 'downward') return false;
  return (
    hasPermission(ctx.actor, 'cycles.manage', ctx.groups) ||
    hasPermission(ctx.actor, 'reviewer_assignments.manage', ctx.groups)
  );
}

/**
 * 대리 작성 — cycles.manage 권한자만.
 * 평가권자/리더는 자기 권한 범위에서 직접 작성 가능하므로 대리 불요.
 */
export function canProxyWrite(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.status === 'submitted') return false;
  return hasPermission(ctx.actor, 'cycles.manage', ctx.groups);
}

/**
 * 제출 재오픈.
 * - cycles.manage 권한자: 모든 제출
 * - 평가권자: 자기 reviewee 의 제출된 submission
 */
export function canReopenSubmission(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.status !== 'submitted') return false;
  if (hasPermission(ctx.actor, 'cycles.manage', ctx.groups)) return true;
  if (ctx.submission && isAssignedReviewer(ctx.actor, ctx.submission, ctx.assignments)) {
    return true;
  }
  return false;
}

export function canViewAuditLog(actor: User | null | undefined, groups?: PermissionGroup[]): boolean {
  return hasPermission(actor, 'audit.view', groups);
}

export function canBulkIntervene(
  ctx: Pick<PermissionContext, 'actor' | 'cycle' | 'groups'>,
): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  return hasPermission(ctx.actor, 'cycles.manage', ctx.groups);
}

/**
 * 결과 열람 (타인 submission).
 * - reports.view_all 또는 cycles.manage: 모든 submission
 * - 평가권자: 자기 reviewee 의 모든 submission
 */
export function canViewSubmissionResult(ctx: PermissionContext): boolean {
  if (
    hasPermission(ctx.actor, 'reports.view_all', ctx.groups) ||
    hasPermission(ctx.actor, 'cycles.manage', ctx.groups)
  ) return true;
  if (ctx.submission && isAssignedReviewer(ctx.actor, ctx.submission, ctx.assignments)) {
    return true;
  }
  return false;
}

/**
 * 동료 제안 승인/반려.
 * - cycles.manage 권한자: 모든 제안
 * - 평가권자: 자기 reviewee 의 제안만
 */
export function canDecidePeerProposal(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (hasPermission(ctx.actor, 'cycles.manage', ctx.groups)) return true;
  if (ctx.submission && isAssignedReviewer(ctx.actor, ctx.submission, ctx.assignments)) {
    return true;
  }
  return false;
}

/**
 * R6: 마스터 로그인 사용 가능 여부.
 */
export function canImpersonate(actor: User | null | undefined, groups?: PermissionGroup[]): boolean {
  return hasPermission(actor, 'auth.impersonate', groups);
}

// 호환을 위해 `isAdmin` 도 export — 일부 legacy 호출처에서 사용.
export { isAdmin };
