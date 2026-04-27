import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { hasPermission } from '../utils/permissions';
import type { PermissionCode, UserRole } from '../types';

/**
 * UI 메뉴/탭 가시성 권한 — `permissions.ts` 의 액션 권한과 동일 어휘.
 *
 * R6 정의 (PermissionGroup 기반)
 * - admin role: 자동으로 모든 권한 (소유자 그룹)
 * - 그 외: PermissionGroup 멤버십 기반 권한 합집합
 * - 평가권자(rank≥1, 활성 ReviewerAssignment 보유): 팀 리뷰/하향 작성 가능
 * - 조직 리더(orgUnit.headId === currentUser.id): 자조직 멤버 관련 메뉴 가시
 * - leader role: legacy 호환 — viewTeamReviews 와 동치
 */
export function usePermission() {
  const { currentUser } = useAuthStore();
  const orgUnits = useTeamStore(s => s.orgUnits);
  const reviewerAssignments = useTeamStore(s => s.reviewerAssignments);
  const permissionGroups = useTeamStore(s => s.permissionGroups);

  const role = currentUser?.role;
  const isOrgHead = !!currentUser && orgUnits.some(u => u.headId === currentUser.id);
  // R2: 평가권자 = 활성 평가권을 1개 이상 보유한 사용자
  const isReviewerInAssignments = !!currentUser && reviewerAssignments.some(a =>
    a.reviewerId === currentUser.id && !a.endDate
  );

  const has = (code: PermissionCode) => hasPermission(currentUser, code, permissionGroups);

  // 팀 리뷰 메뉴 가시성: 평가권자/조직 리더/leader role/cycles.manage 권한자
  const canSeeTeamView =
    role === 'admin' ||
    role === 'leader' ||
    isOrgHead ||
    isReviewerInAssignments ||
    has('cycles.manage');

  return {
    isAdmin:   role === 'admin',
    isLeader:  canSeeTeamView,
    isMember:  !!role,
    hasRole: (requiredRoles: UserRole[]) => !!role && requiredRoles.includes(role),
    isReviewer: isReviewerInAssignments,
    isOrgHead,

    /** R6: 권한 코드 직접 체크 */
    has,

    can: {
      manageCycles:        has('cycles.manage'),
      manageTemplates:     has('templates.manage'),
      writeDownwardReview: canSeeTeamView,
      viewTeamReviews:     canSeeTeamView,
      viewAllReports:      has('reports.view_all'),
      manageOrg:           has('org.manage'),
      // R6 신규
      managePermissionGroups: has('permission_groups.manage'),
      impersonate:            has('auth.impersonate'),
      viewAuditLog:           has('audit.view'),
      manageSettings:         has('settings.manage'),
      manageReviewerAssignments: has('reviewer_assignments.manage'),
    },
  };
}
