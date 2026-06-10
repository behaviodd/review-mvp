import { describe, it, expect } from 'vitest';
import { resolveOrgUnitIds } from './resolveOrgUnitIds';
import type { OrgUnit, User } from '../types';

const u = (over: Partial<User>): User => ({
  id: 'u', name: '홍길동', email: 'a@b.c', role: 'member',
  position: '', avatarColor: '#000', department: '', ...over,
});

const orgUnits: OrgUnit[] = [
  { id: 'MO_p', name: '플랫폼 Biz', type: 'mainOrg', order: 0 },
  { id: 'SO_po', name: 'PO', type: 'subOrg', parentId: 'MO_p', order: 0 },
  { id: 'TM_eng', name: '엔지니어링', type: 'team', parentId: 'SO_po', order: 0 },
  { id: 'TM_b2b', name: 'B2B 사업팀', type: 'team', parentId: 'MO_p', order: 1 },
  { id: 'SQ_a', name: '스쿼드1', type: 'squad', parentId: 'TM_eng', order: 0 },
  { id: 'MO_q', name: '운영본부', type: 'mainOrg', order: 1 },
  { id: 'SQ_b', name: '스쿼드1', type: 'squad', parentId: 'MO_q', order: 0 },
];

describe('resolveOrgUnitIds', () => {
  it('유효한 orgUnitId 는 그대로 보존(미변경)', () => {
    const user = u({ id: 'u1', orgUnitId: 'TM_eng', department: '플랫폼 Biz', team: '엔지니어링' });
    const { users, filledCount } = resolveOrgUnitIds([user], orgUnits);
    expect(users[0].orgUnitId).toBe('TM_eng');
    expect(users[0]).toBe(user); // 동일 참조 — 비파괴
    expect(filledCount).toBe(0);
  });

  it('빈 orgUnitId 는 가장 깊은 이름(팀)으로 해석', () => {
    const user = u({ id: 'u2', department: '플랫폼 Biz', subOrg: 'PO', team: '엔지니어링' });
    const { users, filledCount } = resolveOrgUnitIds([user], orgUnits);
    expect(users[0].orgUnitId).toBe('TM_eng');
    expect(filledCount).toBe(1);
  });

  it('중간 공백 차이(B2B사업팀 vs B2B 사업팀)도 매칭', () => {
    const user = u({ id: 'u3', department: '플랫폼 Biz', team: 'B2B사업팀' });
    const { users } = resolveOrgUnitIds([user], orgUnits);
    expect(users[0].orgUnitId).toBe('TM_b2b');
  });

  it('동명 노드는 상위 경로(조상)로 구분', () => {
    const user = u({ id: 'u4', department: '플랫폼 Biz', subOrg: 'PO', team: '엔지니어링', squad: '스쿼드1' });
    const { users } = resolveOrgUnitIds([user], orgUnits);
    expect(users[0].orgUnitId).toBe('SQ_a'); // 운영본부 하위 SQ_b 아님
  });

  it('무효한(존재 안 하는) orgUnitId 는 이름으로 재해석', () => {
    const user = u({ id: 'u6', orgUnitId: 'GHOST', department: '운영본부' });
    const { users } = resolveOrgUnitIds([user], orgUnits);
    expect(users[0].orgUnitId).toBe('MO_q');
  });

  it('이름경로로도 못 찾으면 unresolved + orgUnitId 미변경', () => {
    const user = u({ id: 'u5', department: '없는조직' });
    const { users, unresolved } = resolveOrgUnitIds([user], orgUnits);
    expect(users[0].orgUnitId).toBeUndefined();
    expect(unresolved.map(x => x.id)).toEqual(['u5']);
  });
});
