/**
 * R4: 사이클의 effective 인사 데이터를 결정.
 *
 * - hrSnapshotMode === 'snapshot' && hrSnapshotId 매칭: 스냅샷 페이로드 사용
 * - 그 외: 현재 store(live) 데이터 사용
 *
 * 사용처: createCycleSubmissions, runPreflight, DryRunModal, OpsCenter 등
 *         사이클의 평가자/대상자 룩업 시점에서 매번 호출.
 */

import type { OrgSnapshot, OrgUnit, ReviewCycle, ReviewerAssignment, User } from '../types';

export interface EffectiveOrgData {
  users: User[];
  orgUnits: OrgUnit[];
  assignments: ReviewerAssignment[];
  source: 'live' | 'snapshot';
  snapshotId?: string;
  snapshotCreatedAt?: string;
}

interface LiveData {
  users: User[];
  orgUnits: OrgUnit[];
  assignments: ReviewerAssignment[];
}

/**
 * 사이클의 인사 데이터 룩업.
 * 사이클 미지정 또는 hrSnapshotMode 'live'/'undefined' 시 live 데이터 반환.
 * snapshot 모드에 hrSnapshotId 가 있으면 해당 OrgSnapshot 페이로드 사용.
 * snapshotId 가 매칭 안 되면 live 로 폴백 (snapshot 삭제 등 대비).
 */
export function resolveEffectiveOrgData(
  cycle: Pick<ReviewCycle, 'hrSnapshotMode' | 'hrSnapshotId'> | undefined | null,
  live: LiveData,
  snapshots: OrgSnapshot[],
): EffectiveOrgData {
  if (cycle?.hrSnapshotMode === 'snapshot' && cycle.hrSnapshotId) {
    const snap = snapshots.find(s => s.id === cycle.hrSnapshotId);
    if (snap) {
      return {
        users:       snap.users,
        orgUnits:    snap.orgUnits,
        assignments: snap.assignments,
        source:      'snapshot',
        snapshotId:  snap.id,
        snapshotCreatedAt: snap.createdAt,
      };
    }
    // 스냅샷 삭제됐거나 누락 → live 폴백
  }
  return {
    users:       live.users,
    orgUnits:    live.orgUnits,
    assignments: live.assignments,
    source:      'live',
  };
}

/**
 * 단순 헬퍼: snapshot 사용 여부.
 */
export function isUsingSnapshot(cycle: Pick<ReviewCycle, 'hrSnapshotMode'> | undefined): boolean {
  return cycle?.hrSnapshotMode === 'snapshot';
}
