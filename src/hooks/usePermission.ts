import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types';

export function usePermission() {
  const { currentUser } = useAuthStore();
  const role = currentUser?.role;

  return {
    isAdmin: role === 'admin',
    isManager: role === 'manager' || role === 'admin',
    isEmployee: !!role,
    hasRole: (requiredRoles: UserRole[]) => !!role && requiredRoles.includes(role),
    can: {
      manageCycles: role === 'admin',
      manageTemplates: role === 'admin',
      writeDownwardReview: role === 'admin' || role === 'manager',
      viewTeamReviews: role === 'admin' || role === 'manager',
      viewAllReports: role === 'admin',
      manageOrg: role === 'admin',
      sendNudge: role === 'admin',
    },
  };
}
