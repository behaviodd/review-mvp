import type { User } from '../types';

/**
 * 가장 하위 소속 조직명 반환 (squad > team > subOrg > department).
 * R1: legacy 필드 존재 시 그대로 사용. 새 모델(orgUnitId 만 있는 사용자)은
 * userCompat.getSmallestOrgCompat(user, units) 사용 권장.
 */
export function getSmallestOrg(user: Pick<User, 'squad' | 'team' | 'subOrg' | 'department'>): string {
  return user.squad ?? user.team ?? user.subOrg ?? user.department ?? '';
}
