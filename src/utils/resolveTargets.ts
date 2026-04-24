import type { ReviewCycle, User } from '../types';

export type TargetCriteria = Pick<
  ReviewCycle,
  'targetMode' | 'targetDepartments' | 'targetManagerId' | 'targetUserIds'
>;

/**
 * targetMode에 따라 리뷰 대상자 집합을 반환한다.
 *  - 'org'    : 기존 targetDepartments 기반 (기본, 하위호환)
 *  - 'manager': 특정 매니저(targetManagerId)의 부하 직원
 *  - 'custom' : 명시적 사용자 id 배열
 * admin 역할은 항상 제외한다.
 */
export function resolveTargetMembers(
  cycle: TargetCriteria,
  users: User[],
): User[] {
  const mode = cycle.targetMode ?? 'org';

  if (mode === 'manager' && cycle.targetManagerId) {
    return users.filter(u =>
      u.managerId === cycle.targetManagerId && u.role !== 'admin'
    );
  }

  if (mode === 'custom' && cycle.targetUserIds?.length) {
    const set = new Set(cycle.targetUserIds);
    return users.filter(u => set.has(u.id) && u.role !== 'admin');
  }

  return users.filter(u =>
    cycle.targetDepartments.includes(u.department) && u.role !== 'admin'
  );
}

/** 현재 대상자 id 집합을 반환 (중복·교집합 체크용) */
export function resolveTargetIds(cycle: TargetCriteria, users: User[]): Set<string> {
  return new Set(resolveTargetMembers(cycle, users).map(u => u.id));
}
