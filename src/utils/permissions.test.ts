import { describe, expect, it } from 'vitest';
import {
  canBulkIntervene,
  canDecidePeerProposal,
  canExtendDeadline,
  canImpersonate,
  canProxyWrite,
  canReassignReviewer,
  canReopenSubmission,
  canUnlockEdit,
  canViewAuditLog,
  canViewSubmissionResult,
  hasPermission,
} from './permissions';
import type {
  PermissionCode,
  PermissionGroup,
  ReviewCycle,
  ReviewerAssignment,
  ReviewSubmission,
  User,
} from '../types';

const now = '2026-04-27T00:00:00.000Z';

function user(id: string, role: User['role'] = 'member'): User {
  return {
    id,
    role,
    name: id,
    email: `${id}@example.com`,
    position: '구성원',
    avatarColor: 'bg-gray-040',
    department: '미배정',
  };
}

function group(id: string, permissions: PermissionCode[], memberIds: string[]): PermissionGroup {
  return {
    id,
    name: id,
    permissions,
    memberIds,
    isSystem: false,
    createdAt: now,
    createdBy: 'system',
  };
}

function cycle(patch: Partial<ReviewCycle> = {}): ReviewCycle {
  return {
    id: 'cycle-1',
    title: '상반기 리뷰',
    type: 'scheduled',
    status: 'self_review',
    templateId: 'template-1',
    targetDepartments: ['전체'],
    selfReviewDeadline: '2026-05-01',
    managerReviewDeadline: '2026-05-10',
    createdBy: 'admin',
    createdAt: now,
    completionRate: 0,
    ...patch,
  };
}

function submission(patch: Partial<ReviewSubmission> = {}): ReviewSubmission {
  return {
    id: 'sub-1',
    cycleId: 'cycle-1',
    reviewerId: 'reviewer',
    revieweeId: 'reviewee',
    type: 'downward',
    status: 'in_progress',
    answers: [],
    lastSavedAt: now,
    ...patch,
  };
}

function assignment(patch: Partial<ReviewerAssignment> = {}): ReviewerAssignment {
  return {
    id: 'ra-1',
    reviewerId: 'reviewer',
    revieweeId: 'reviewee',
    rank: 1,
    source: 'manual',
    startDate: '2026-01-01',
    createdAt: now,
    createdBy: 'admin',
    ...patch,
  };
}

describe('hasPermission', () => {
  it('admin role automatically has every permission', () => {
    expect(hasPermission(user('admin', 'admin'), 'permission_groups.manage', [])).toBe(true);
  });

  it('non-admin users inherit permissions from permission groups', () => {
    const actor = user('ops');
    const groups = [group('review-admin', ['cycles.manage'], ['ops'])];

    expect(hasPermission(actor, 'cycles.manage', groups)).toBe(true);
    expect(hasPermission(actor, 'templates.manage', groups)).toBe(false);
  });

  it('returns false when group data is unavailable', () => {
    expect(hasPermission(user('ops'), 'cycles.manage')).toBe(false);
  });
});

describe('review operation permissions', () => {
  const admin = user('admin', 'admin');
  const reviewer = user('reviewer');
  const member = user('member');
  const cycleManager = user('cycle-manager');
  const assignmentManager = user('assignment-manager');
  const reportViewer = user('report-viewer');
  const auditor = user('auditor');
  const impersonator = user('impersonator');
  const groups = [
    group('cycle-admin', ['cycles.manage'], ['cycle-manager']),
    group('assignment-admin', ['reviewer_assignments.manage'], ['assignment-manager']),
    group('reports', ['reports.view_all'], ['report-viewer']),
    group('audit', ['audit.view'], ['auditor']),
    group('impersonate', ['auth.impersonate'], ['impersonator']),
  ];
  const activeCycle = cycle();
  const closedCycle = cycle({ status: 'closed' });
  const lockedCycle = cycle({ editLockedAt: now });
  const downward = submission();
  const selfReview = submission({ type: 'self' });
  const submitted = submission({ status: 'submitted' });
  const assignments = [assignment()];

  it('allows cycles.manage holders to unlock edits and bulk intervene', () => {
    expect(canUnlockEdit(cycleManager, groups)).toBe(true);
    expect(canBulkIntervene({ actor: cycleManager, cycle: activeCycle, groups })).toBe(true);
    expect(canBulkIntervene({ actor: member, cycle: activeCycle, groups })).toBe(false);
  });

  it('blocks mutable operations for closed or locked cycles', () => {
    expect(canExtendDeadline({ actor: admin, cycle: closedCycle, submission: downward, groups })).toBe(false);
    expect(canReopenSubmission({ actor: admin, cycle: lockedCycle, submission: submitted, groups })).toBe(false);
    expect(canBulkIntervene({ actor: cycleManager, cycle: lockedCycle, groups })).toBe(false);
  });

  it('allows deadline extension for cycles.manage holders and assigned reviewers', () => {
    expect(canExtendDeadline({ actor: cycleManager, cycle: activeCycle, submission: downward, groups })).toBe(true);
    expect(canExtendDeadline({ actor: reviewer, cycle: activeCycle, submission: downward, assignments, groups })).toBe(true);
    expect(canExtendDeadline({ actor: member, cycle: activeCycle, submission: downward, assignments, groups })).toBe(false);
  });

  it('allows reviewer reassignment only for proper permission holders and downward submissions', () => {
    expect(canReassignReviewer({ actor: cycleManager, cycle: activeCycle, submission: downward, groups })).toBe(true);
    expect(canReassignReviewer({ actor: assignmentManager, cycle: activeCycle, submission: downward, groups })).toBe(true);
    expect(canReassignReviewer({ actor: assignmentManager, cycle: activeCycle, submission: selfReview, groups })).toBe(false);
    expect(canReassignReviewer({ actor: member, cycle: activeCycle, submission: downward, groups })).toBe(false);
  });

  it('allows proxy write only for cycles.manage holders and unsubmitted submissions', () => {
    expect(canProxyWrite({ actor: cycleManager, cycle: activeCycle, submission: downward, groups })).toBe(true);
    expect(canProxyWrite({ actor: cycleManager, cycle: activeCycle, submission: submitted, groups })).toBe(false);
    expect(canProxyWrite({ actor: reviewer, cycle: activeCycle, submission: downward, assignments, groups })).toBe(false);
  });

  it('allows reopening submitted reviews for cycles.manage holders and assigned reviewers', () => {
    expect(canReopenSubmission({ actor: cycleManager, cycle: activeCycle, submission: submitted, groups })).toBe(true);
    expect(canReopenSubmission({ actor: reviewer, cycle: activeCycle, submission: submitted, assignments, groups })).toBe(true);
    expect(canReopenSubmission({ actor: reviewer, cycle: activeCycle, submission: downward, assignments, groups })).toBe(false);
  });

  it('allows result viewing for reports/cycles permission holders and assigned reviewers', () => {
    expect(canViewSubmissionResult({ actor: reportViewer, submission: downward, groups })).toBe(true);
    expect(canViewSubmissionResult({ actor: cycleManager, submission: downward, groups })).toBe(true);
    expect(canViewSubmissionResult({ actor: reviewer, submission: downward, assignments, groups })).toBe(true);
    expect(canViewSubmissionResult({ actor: member, submission: downward, assignments, groups })).toBe(false);
  });

  it('allows peer proposal decisions for cycles.manage holders and assigned reviewers', () => {
    expect(canDecidePeerProposal({ actor: cycleManager, cycle: activeCycle, submission: downward, groups })).toBe(true);
    expect(canDecidePeerProposal({ actor: reviewer, cycle: activeCycle, submission: downward, assignments, groups })).toBe(true);
    expect(canDecidePeerProposal({ actor: member, cycle: activeCycle, submission: downward, assignments, groups })).toBe(false);
  });

  it('maps audit and impersonation capabilities to their permission codes', () => {
    expect(canViewAuditLog(auditor, groups)).toBe(true);
    expect(canViewAuditLog(member, groups)).toBe(false);
    expect(canImpersonate(impersonator, groups)).toBe(true);
    expect(canImpersonate(member, groups)).toBe(false);
  });
});
