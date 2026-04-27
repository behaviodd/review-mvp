/**
 * R1 호환 어댑터 — 신규 모델(orgUnitId, activityStatus, reviewerAssignments)을
 * 기존 코드(department/subOrg/team/squad/isActive/managerId)와 양방향 호환.
 *
 * R3 종료 시점에 deprecated 함수 제거 + 호출처 새 모델 직접 사용으로 전환.
 */

import type { OrgUnit, ReviewerAssignment, User } from '../types';

// ─────── 조직 트리 헬퍼 ───────

/**
 * orgUnitId 부터 루트까지 거슬러올라가며 OrgUnit 체인 반환.
 * [현재조직, 부모, 조부모, ..., 루트] 순서.
 */
export function getOrgChain(orgUnitId: string | undefined, units: OrgUnit[]): OrgUnit[] {
  if (!orgUnitId) return [];
  const chain: OrgUnit[] = [];
  let cursor = units.find(u => u.id === orgUnitId);
  while (cursor) {
    chain.push(cursor);
    cursor = cursor.parentId ? units.find(u => u.id === cursor!.parentId) : undefined;
  }
  return chain;
}

/**
 * OrgUnit 의 트리 depth (루트=0).
 * @deprecated R3 에서 제거 — type 필드 대신 사용.
 */
export function getOrgDepth(unit: OrgUnit, units: OrgUnit[]): number {
  let depth = 0;
  let cursor = unit;
  while (cursor.parentId) {
    const parent = units.find(u => u.id === cursor.parentId);
    if (!parent) break;
    cursor = parent;
    depth += 1;
  }
  return depth;
}

// ─────── User 조회 헬퍼 (legacy 4단계 우선 → 신모델 fallback) ───────
//
// 마이그레이션 후에도 기존 user.department 등 직접 접근 코드를 안전하게
// 받쳐주기 위해 여전히 legacy 필드를 우선 사용. 신규 사용자나 legacy 가
// 비어있는 경우만 OrgUnit 트리에서 유도.

/** mainOrg 이름. user.department 또는 트리에서 mainOrg 노드 이름. */
export function legacyDepartment(user: User, units: OrgUnit[]): string {
  if (user.department) return user.department;
  const chain = getOrgChain(user.orgUnitId, units);
  // mainOrg 우선 (type 매칭), 없으면 루트
  const mainOrg = chain.find(u => u.type === 'mainOrg') ?? chain[chain.length - 1];
  return mainOrg?.name ?? '';
}

/** subOrg 이름. user.subOrg 또는 트리에서 subOrg 단계 노드 이름. */
export function legacySubOrg(user: User, units: OrgUnit[]): string | undefined {
  if (user.subOrg) return user.subOrg;
  const chain = getOrgChain(user.orgUnitId, units);
  return chain.find(u => u.type === 'subOrg')?.name;
}

/** team 이름. */
export function legacyTeam(user: User, units: OrgUnit[]): string | undefined {
  if (user.team) return user.team;
  const chain = getOrgChain(user.orgUnitId, units);
  return chain.find(u => u.type === 'team')?.name;
}

/** squad 이름. */
export function legacySquad(user: User, units: OrgUnit[]): string | undefined {
  if (user.squad) return user.squad;
  const chain = getOrgChain(user.orgUnitId, units);
  return chain.find(u => u.type === 'squad')?.name;
}

// ─────── activityStatus 헬퍼 ───────

/**
 * 활동 중인 사용자인지 (사이클 자동 제외 대상이 아닌지).
 * - active / leave_short / other → 활동 중
 * - leave_long / terminated → 비활동
 * - activityStatus 미설정 시: legacy isActive 사용 (기본 true)
 */
export function isUserActive(user: User): boolean {
  if (user.activityStatus) {
    return user.activityStatus === 'active' ||
           user.activityStatus === 'leave_short' ||
           user.activityStatus === 'other';
  }
  // legacy fallback
  return user.isActive !== false;
}

/**
 * 사이클에서 자동 제외되어야 하는 사용자.
 * 기본 정책: leave_long, terminated 만 제외.
 * leave_short / other 는 운영자가 직접 제외해야 함.
 */
export function shouldAutoExcludeFromCycle(user: User): boolean {
  if (user.activityStatus) {
    return user.activityStatus === 'terminated' || user.activityStatus === 'leave_long';
  }
  // legacy: isActive=false 도 제외 대상
  return user.isActive === false;
}

// ─────── 평가권 헬퍼 ───────

/**
 * 특정 reviewee 의 차수별 활성 평가권자 매핑.
 * { 1: 'reviewerId', 2: 'reviewerId', ... }
 */
export function getActiveReviewersByRank(
  revieweeId: string,
  assignments: ReviewerAssignment[],
): Record<number, string> {
  const result: Record<number, string> = {};
  for (const a of assignments) {
    if (a.revieweeId !== revieweeId) continue;
    if (a.endDate) continue;
    // 같은 rank 에 여러 활성 항목이 있으면 가장 최근 createdAt 우선
    const existing = result[a.rank];
    if (!existing) {
      result[a.rank] = a.reviewerId;
    } else {
      const existingAssign = assignments.find(x => x.reviewerId === existing && x.revieweeId === revieweeId && x.rank === a.rank && !x.endDate);
      if (existingAssign && a.createdAt > existingAssign.createdAt) {
        result[a.rank] = a.reviewerId;
      }
    }
  }
  return result;
}

/**
 * 1차 평가권자 (가장 흔히 쓰이는 = 직속 매니저 역할).
 * 신규 모델: ReviewerAssignment(rank=1) → reviewer.
 * Fallback: user.managerId.
 */
export function resolvePrimaryReviewer(
  user: User,
  assignments: ReviewerAssignment[],
): string | undefined {
  const byRank = getActiveReviewersByRank(user.id, assignments);
  if (byRank[1]) return byRank[1];
  // legacy fallback
  return user.managerId;
}

// ─────── orgUnit 의 멤버 조회 ───────

/** orgUnitId 와 그 하위 모든 조직의 멤버를 모음. */
export function getDescendantOrgUnitIds(orgUnitId: string, units: OrgUnit[]): Set<string> {
  const set = new Set<string>([orgUnitId]);
  let added = true;
  while (added) {
    added = false;
    for (const u of units) {
      if (u.parentId && set.has(u.parentId) && !set.has(u.id)) {
        set.add(u.id);
        added = true;
      }
    }
  }
  return set;
}

/** orgUnit 직속 + 하위 모든 멤버 조회. */
export function getMembersInOrgTree(
  orgUnitId: string,
  users: User[],
  units: OrgUnit[],
): User[] {
  const ids = getDescendantOrgUnitIds(orgUnitId, units);
  return users.filter(u => u.orgUnitId && ids.has(u.orgUnitId));
}

// ─────── 기존 getSmallestOrg 호환 유지 (userUtils.ts 에서 재export) ───────

export function getSmallestOrgCompat(user: User, units: OrgUnit[]): string {
  return (
    legacySquad(user, units) ??
    legacyTeam(user, units) ??
    legacySubOrg(user, units) ??
    legacyDepartment(user, units)
  );
}
