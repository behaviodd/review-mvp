/**
 * 관리자 개입 액션에 대한 권한 판단을 한곳에서 관리한다.
 * Phase 2는 admin만 허용하지만, 조직장/리더까지 확장할 때 이 파일만 수정하면 된다.
 */
import type { ReviewCycle, ReviewSubmission, User } from '../types';

export interface PermissionContext {
  actor: User | null;
  cycle?: ReviewCycle;
  submission?: ReviewSubmission;
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

export function canUnlockEdit(actor: User | null | undefined): boolean {
  return isAdmin(actor);
}

export function canExtendDeadline(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  return isAdmin(ctx.actor);
}

export function canReassignReviewer(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.type !== 'downward') return false;
  return isAdmin(ctx.actor);
}

export function canProxyWrite(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.status === 'submitted') return false;
  return isAdmin(ctx.actor);
}

export function canReopenSubmission(ctx: PermissionContext): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  if (ctx.submission && ctx.submission.status !== 'submitted') return false;
  return isAdmin(ctx.actor);
}

export function canViewAuditLog(actor: User | null | undefined): boolean {
  return isAdmin(actor);
}

export function canBulkIntervene(ctx: Pick<PermissionContext, 'actor' | 'cycle'>): boolean {
  if (!isCycleMutable(ctx.cycle)) return false;
  return isAdmin(ctx.actor);
}
