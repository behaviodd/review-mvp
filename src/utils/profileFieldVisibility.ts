import type {
  OrgUnit,
  ProfileFieldConfig,
  ProfileFieldKey,
  ProfileFieldViewer,
  ReviewerAssignment,
  User,
} from '../types';
import { PROFILE_FIELD_LOCKED } from '../stores/profileFieldStore';

/**
 * 현재 사용자가 대상자(target)에 대해 가지는 viewer 카테고리 집합을 반환한다.
 * admin 여부는 별도로 판정해 canViewField 의 isAdmin 인자로 전달.
 */
export function getViewerTypes(
  currentUser: User | null,
  target: User,
  orgUnits: OrgUnit[],
  reviewerAssignments: ReviewerAssignment[],
): Set<ProfileFieldViewer> {
  const types = new Set<ProfileFieldViewer>();
  if (!currentUser) return types;

  if (currentUser.id === target.id) types.add('self');

  const targetOrgNames = [target.department, target.subOrg, target.team, target.squad].filter(Boolean) as string[];
  if (orgUnits.some(o => o.headId === currentUser.id && targetOrgNames.includes(o.name))) {
    types.add('orgLeader');
  }

  if (reviewerAssignments.some(a =>
    a.reviewerId === currentUser.id && a.revieweeId === target.id && !a.endDate
  )) {
    types.add('reviewer');
  }

  types.add('allMembers');
  return types;
}

export function canViewField(
  viewerTypes: Set<ProfileFieldViewer>,
  field: ProfileFieldConfig,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (PROFILE_FIELD_LOCKED.includes(field.key)) return true;
  return field.viewers.some(v => viewerTypes.has(v));
}

export function getFieldValue(user: User, key: ProfileFieldKey): string {
  switch (key) {
    case 'name':        return user.name;
    case 'nameEn':      return user.nameEn ?? '';
    case 'email':       return user.email;
    case 'phone':       return user.phone ?? '';
    case 'joinDate':    return user.joinDate ?? '';
    case 'jobFunction': return user.jobFunction ?? '';
  }
}
