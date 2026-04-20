import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types';

export function usePermission() {
  const { currentUser } = useAuthStore();
  const role = currentUser?.role;

  return {
    isAdmin:   role === 'admin',
    isLeader:  role === 'leader' || role === 'admin',
    isMember:  !!role,
    hasRole: (requiredRoles: UserRole[]) => !!role && requiredRoles.includes(role),
    can: {
      manageCycles:        role === 'admin',
      manageTemplates:     role === 'admin',
      writeDownwardReview: role === 'admin' || role === 'leader',
      viewTeamReviews:     role === 'admin' || role === 'leader',
      viewAllReports:      role === 'admin',
      manageOrg:           role === 'admin',
    },
  };
}
