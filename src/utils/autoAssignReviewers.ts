/**
 * 평가자 자동 지정 계산 유틸.
 *
 * 우선순위:
 *   1순위 — user.managerId 가 활성 구성원이면 → managerId 를 rank=1 평가자로 (source='manual')
 *   2순위 — user.orgUnitId 기준 조직 계층을 위로 탐색해 가장 가까운 headId → rank=1 (source='org_head_inherited')
 *   배정 불가 — reviewerId = null (경고)
 *
 * 순수 함수: store 직접 호출 없음. 결과를 UI 에서 확인 후 store 에 일괄 적용.
 */
import type { OrgUnit, ReviewerAssignmentSource, User } from '../types';
import { isUserActive } from './userCompat';

export interface AutoAssignCandidate {
  revieweeId:   string;
  reviewerId:   string | null;          // null = 배정 불가
  source:       ReviewerAssignmentSource;
  reason:       'managerId' | 'orgHead' | 'none';
  /** 이미 활성 rank=1 배정 있음 → skip 또는 overwrite 선택 */
  hasExisting:  boolean;
  existingReviewerId?: string;
}

/** orgUnitId 기준 계층 상향 탐색 — headId 가 있는 가장 가까운 조직 반환 */
function findNearestOrgHead(
  orgUnitId: string,
  orgUnits: OrgUnit[],
  activeIds: Set<string>,
  selfId: string,
): string | null {
  let currentId: string | undefined = orgUnitId;
  while (currentId) {
    const unit = orgUnits.find(u => u.id === currentId);
    if (!unit) break;
    if (unit.headId && unit.headId !== selfId && activeIds.has(unit.headId)) {
      return unit.headId;
    }
    currentId = unit.parentId;
  }
  return null;
}

/**
 * 모든 활성 구성원에 대해 자동 배정 후보를 계산한다.
 * 본인에게 자기 자신을 배정하지 않는다.
 */
export function computeAutoAssignments(
  users: User[],
  orgUnits: OrgUnit[],
): AutoAssignCandidate[] {
  const activeUsers = users.filter(u => isUserActive(u));
  const activeIds   = new Set(activeUsers.map(u => u.id));

  return activeUsers.map(u => {
    // 1순위: managerId (보고대상 = 평가자)
    if (u.managerId && activeIds.has(u.managerId) && u.managerId !== u.id) {
      return {
        revieweeId: u.id,
        reviewerId: u.managerId,
        source:     'manual' as const,
        reason:     'managerId' as const,
        hasExisting: !!u.managerId,
        existingReviewerId: u.managerId,
      };
    }

    // 2순위: 가장 가까운 조직장
    if (u.orgUnitId) {
      const headId = findNearestOrgHead(u.orgUnitId, orgUnits, activeIds, u.id);
      if (headId) {
        return {
          revieweeId: u.id,
          reviewerId: headId,
          source:     'org_head_inherited' as const,
          reason:     'orgHead' as const,
          hasExisting: !!u.managerId,
          existingReviewerId: u.managerId,
        };
      }
    }

    // legacy: department 이름으로 orgUnit 역탐색
    if (u.department) {
      const mainOrg = orgUnits.find(o => o.type === 'mainOrg' && o.name === u.department);
      if (mainOrg) {
        const headId = findNearestOrgHead(mainOrg.id, orgUnits, activeIds, u.id);
        if (headId) {
          return {
            revieweeId: u.id,
            reviewerId: headId,
            source:     'org_head_inherited' as const,
            reason:     'orgHead' as const,
            hasExisting: !!u.managerId,
            existingReviewerId: u.managerId,
          };
        }
      }
    }

    return {
      revieweeId: u.id,
      reviewerId: null,
      source:     'manual' as const,
      reason:     'none' as const,
      hasExisting: !!u.managerId,
      existingReviewerId: u.managerId,
    };
  });
}
