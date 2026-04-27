/**
 * R1 마이그레이션 — 조직·평가권 데이터 모델 재설계
 *
 * 호출 시점: useTeamStore persist 의 onRehydrateStorage 후크에서 1회 자동 실행.
 * 멱등성: schemaVersion 'r1' 마킹 시 skip.
 *
 * 변환 내용
 * 1. User: department/subOrg/team/squad 텍스트 → orgUnitId (가장 깊은 매칭)
 * 2. User: isActive → activityStatus ('active' | 'terminated')
 * 3. ReviewerAssignment 시드:
 *    a) user.managerId 존재 시 (rank=1, source='manual') 1건
 *    b) user.managerId 부재 + 소속 조직의 headId 존재 시
 *       (rank=1, source='org_head_inherited') 1건
 * 4. ReviewCycle: hrSnapshotMode 미설정 → 'live' (현재 동작 유지)
 *
 * 보존 항목 (절대 삭제하지 않음)
 * - User.department/subOrg/team/squad (legacy 코드가 직접 읽는 곳 다수)
 * - User.isActive/leaveDate
 * - User.managerId
 * - SecondaryOrgAssignment 전체
 *
 * 단, R3 종료 시점에 위 deprecated 필드 일괄 제거 예정.
 */

import type { OrgUnit, ReviewCycle, ReviewerAssignment, User } from '../../types';

export type SchemaVersion = 'pre-r1' | 'r1';

export interface MigrationInput {
  users: User[];
  orgUnits: OrgUnit[];
  cycles?: ReviewCycle[];
  existingAssignments?: ReviewerAssignment[];
}

export interface MigrationOutput {
  users: User[];
  cycles: ReviewCycle[];
  newAssignments: ReviewerAssignment[];
  schemaVersion: SchemaVersion;
  report: {
    totalUsers: number;
    usersWithOrgUnitId: number;
    usersFallbackOrgUnit: number;     // 매칭 실패 → fallback 사용 수
    usersTerminated: number;
    seededFromManager: number;        // managerId 기반 시드
    seededFromOrgHead: number;        // headId 기반 시드
    skippedHavingAssignment: number;  // 이미 평가권 있어 skip
    warnings: string[];
  };
}

const NOW = () => new Date().toISOString();

const SYSTEM_ACTOR = 'system_migration_r1';

/**
 * 한 user 의 legacy 4단계 텍스트 → orgUnitId 매칭.
 * 가장 깊은 단계(squad → team → subOrg → mainOrg) 부터 OrgUnit.name 매칭.
 */
function resolveOrgUnitId(user: User, orgUnits: OrgUnit[]): { orgUnitId?: string; fallback: boolean } {
  // 가장 구체적인 (가장 깊은) 단계부터 매칭 시도.
  const candidates: { name?: string; type: OrgUnit['type'] }[] = [
    { name: user.squad,      type: 'squad' },
    { name: user.team,       type: 'team' },
    { name: user.subOrg,     type: 'subOrg' },
    { name: user.department, type: 'mainOrg' },
  ];

  for (const c of candidates) {
    if (!c.name) continue;
    // type 우선 매칭, 없으면 name 만
    const exact = orgUnits.find(u => u.name === c.name && u.type === c.type);
    if (exact) return { orgUnitId: exact.id, fallback: false };
    const byName = orgUnits.find(u => u.name === c.name);
    if (byName) return { orgUnitId: byName.id, fallback: false };
  }

  // 매칭 실패 → fallback: 첫 mainOrg
  const firstMain = orgUnits.find(u => u.type === 'mainOrg' || u.parentId == null);
  if (firstMain) return { orgUnitId: firstMain.id, fallback: true };

  // 조직 트리 자체가 비어 있는 경우 — orgUnitId 미설정
  return { orgUnitId: undefined, fallback: true };
}

/**
 * activityStatus 추론.
 * - isActive === false → 'terminated'
 * - 그 외 → 'active'
 */
function deriveActivityStatus(user: User): User['activityStatus'] {
  if (user.activityStatus) return user.activityStatus; // 이미 신규 모델
  if (user.isActive === false) return 'terminated';
  return 'active';
}

/**
 * 평가권 시드 1건 생성 헬퍼.
 */
function buildAssignment(
  revieweeId: string,
  reviewerId: string,
  source: ReviewerAssignment['source'],
): ReviewerAssignment {
  const id = `ra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    revieweeId,
    reviewerId,
    rank: 1,
    source,
    startDate: NOW(),
    createdAt: NOW(),
    createdBy: SYSTEM_ACTOR,
  };
}

/**
 * 메인 마이그레이션. 입력은 깊은 복제하지 않고 새 객체를 반환.
 */
export function migrateToR1(input: MigrationInput): MigrationOutput {
  const { users, orgUnits, cycles = [], existingAssignments = [] } = input;
  const warnings: string[] = [];
  const report: MigrationOutput['report'] = {
    totalUsers: users.length,
    usersWithOrgUnitId: 0,
    usersFallbackOrgUnit: 0,
    usersTerminated: 0,
    seededFromManager: 0,
    seededFromOrgHead: 0,
    skippedHavingAssignment: 0,
    warnings,
  };

  // 1. User 변환
  const migratedUsers: User[] = users.map(u => {
    const next: User = { ...u };

    // orgUnitId 채우기 (이미 있으면 보존)
    if (!next.orgUnitId) {
      const { orgUnitId, fallback } = resolveOrgUnitId(u, orgUnits);
      if (orgUnitId) {
        next.orgUnitId = orgUnitId;
        report.usersWithOrgUnitId += 1;
        if (fallback) {
          report.usersFallbackOrgUnit += 1;
          warnings.push(`user ${u.id} (${u.name}): 4단계 텍스트 → OrgUnit 매칭 실패, fallback 사용 (id=${orgUnitId})`);
        }
      } else {
        warnings.push(`user ${u.id} (${u.name}): orgUnitId 결정 불가 (조직 트리 비어있음)`);
      }
    } else {
      report.usersWithOrgUnitId += 1;
    }

    // activityStatus 채우기
    if (!next.activityStatus) {
      next.activityStatus = deriveActivityStatus(u);
      if (next.activityStatus === 'terminated') {
        report.usersTerminated += 1;
        if (u.leaveDate) next.statusChangedAt = u.leaveDate;
      }
    }

    return next;
  });

  // 2. ReviewerAssignment 시드 (멱등성: revieweeId+rank 활성 항목 존재 시 skip)
  const activeAssignmentSet = new Set(
    existingAssignments
      .filter(a => !a.endDate)
      .map(a => `${a.revieweeId}:${a.rank}`),
  );

  const newAssignments: ReviewerAssignment[] = [];

  for (const user of migratedUsers) {
    if (user.role === 'admin') continue;

    const key = `${user.id}:1`;
    if (activeAssignmentSet.has(key)) {
      report.skippedHavingAssignment += 1;
      continue;
    }

    // a) user.managerId 우선
    if (user.managerId) {
      const manager = migratedUsers.find(u => u.id === user.managerId);
      if (manager && manager.role !== 'admin') {
        newAssignments.push(buildAssignment(user.id, user.managerId, 'manual'));
        activeAssignmentSet.add(key);
        report.seededFromManager += 1;
        continue;
      }
    }

    // b) 소속 조직의 headId fallback (자기 자신은 제외)
    if (user.orgUnitId) {
      // 현재 orgUnit 부터 부모로 올라가며 headId 있는 조직 탐색
      let cursor = orgUnits.find(o => o.id === user.orgUnitId);
      let found = false;
      while (cursor) {
        if (cursor.headId && cursor.headId !== user.id) {
          const head = migratedUsers.find(u => u.id === cursor!.headId);
          if (head && head.role !== 'admin') {
            newAssignments.push(buildAssignment(user.id, cursor.headId, 'org_head_inherited'));
            activeAssignmentSet.add(key);
            report.seededFromOrgHead += 1;
            found = true;
            break;
          }
        }
        cursor = cursor.parentId ? orgUnits.find(o => o.id === cursor!.parentId) : undefined;
      }
      if (!found) {
        warnings.push(`user ${user.id} (${user.name}): 평가권자 시드 실패 (managerId/orgHead 모두 없음)`);
      }
    }
  }

  // 3. ReviewCycle: hrSnapshotMode 미설정 시 'live' (호환)
  const migratedCycles: ReviewCycle[] = cycles.map(c => {
    if (c.hrSnapshotMode) return c;
    return { ...c, hrSnapshotMode: 'live' as const };
  });

  return {
    users: migratedUsers,
    cycles: migratedCycles,
    newAssignments,
    schemaVersion: 'r1',
    report,
  };
}

/**
 * 단위 케이스 검증용 — 개발/테스트 시 사용.
 */
export function isMigrationApplied(version: SchemaVersion | undefined): boolean {
  return version === 'r1';
}
