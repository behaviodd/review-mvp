import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import type { UserRole } from '../types';

/**
 * UI 메뉴/탭 가시성 권한 — `permissions.ts` 의 액션 권한과 동일 어휘.
 *
 * R2 정의
 * - admin: 모든 권한
 * - 평가권자(rank≥1, 활성 ReviewerAssignment 보유): 팀 리뷰/하향 작성 가능
 * - 조직 리더(orgUnit.headId === currentUser.id): 자조직 멤버 관련 메뉴 가시
 * - leader 역할: 평가권자 또는 조직 리더로 자동 인정 (legacy 호환)
 */
export function usePermission() {
  const { currentUser } = useAuthStore();
  const orgUnits = useTeamStore(s => s.orgUnits);
  const reviewerAssignments = useTeamStore(s => s.reviewerAssignments);

  const role = currentUser?.role;
  const isOrgHead = !!currentUser && orgUnits.some(u => u.headId === currentUser.id);
  // R2: 평가권자 = 활성 평가권을 1개 이상 보유한 사용자
  const isReviewerInAssignments = !!currentUser && reviewerAssignments.some(a =>
    a.reviewerId === currentUser.id && !a.endDate
  );
  // 평가권자/조직 리더/leader 역할 중 하나라도 만족하면 팀 리뷰 메뉴 가시
  const canSeeTeamView =
    role === 'admin' || role === 'leader' || isOrgHead || isReviewerInAssignments;

  return {
    isAdmin:   role === 'admin',
    // R2: leader = admin 외에 평가권자/조직 리더 모두 포함
    isLeader:  canSeeTeamView,
    isMember:  !!role,
    hasRole: (requiredRoles: UserRole[]) => !!role && requiredRoles.includes(role),
    // R2: 평가권자 여부 노출 (Sidebar 등에서 활용)
    isReviewer: isReviewerInAssignments,
    isOrgHead,
    can: {
      manageCycles:        role === 'admin',
      manageTemplates:     role === 'admin',
      writeDownwardReview: canSeeTeamView,
      viewTeamReviews:     canSeeTeamView,
      viewAllReports:      role === 'admin',
      manageOrg:           role === 'admin',
    },
  };
}
