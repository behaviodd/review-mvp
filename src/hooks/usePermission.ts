import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import type { UserRole } from '../types';

export function usePermission() {
  const { currentUser } = useAuthStore();
  const orgUnits = useTeamStore(s => s.orgUnits);
  const role = currentUser?.role;
  const isOrgHead = !!currentUser && orgUnits.some(u => u.headId === currentUser.id);

  return {
    isAdmin:   role === 'admin',
    isLeader:  role === 'admin' || role === 'leader' || isOrgHead,
    isMember:  !!role,
    hasRole: (requiredRoles: UserRole[]) => !!role && requiredRoles.includes(role),
    can: {
      manageCycles:        role === 'admin',
      manageTemplates:     role === 'admin',
      writeDownwardReview: role === 'admin' || role === 'leader' || isOrgHead,
      viewTeamReviews:     role === 'admin' || role === 'leader' || isOrgHead,
      viewAllReports:      role === 'admin',
      manageOrg:           role === 'admin',
    },
  };
}
