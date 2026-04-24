import type { User } from '../types';

/** 가장 하위 소속 조직명 반환 (squad > team > subOrg > department) */
export function getSmallestOrg(user: Pick<User, 'squad' | 'team' | 'subOrg' | 'department'>): string {
  return user.squad ?? user.team ?? user.subOrg ?? user.department;
}
